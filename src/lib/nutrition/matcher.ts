/**
 * Food name matching: a lazily built alias index plus
 *  - findFood():    best single food for a free-text name,
 *  - searchFoods(): ranked autocomplete,
 *  - coverRun():    splits a run of words into one or more foods (used by the meal parser).
 */
import { FOODS } from "./foods";
import type { FoodEntry } from "./types";
import {
  CANON,
  FILLERS,
  IGNORABLE,
  MEAL_WORDS,
  NEGATIONS,
  NUM_PREFIX,
  NUM_WORDS,
  PORTIONS,
  RESTAURANT_WORDS,
  SIZE_WORDS,
  basicNormalize,
  dict,
  levenshtein,
  titleCase,
} from "./text";

export type MatchKind = "exact" | "fuzzy" | "merged" | "overlap";

export interface FoodMatch {
  food: FoodEntry;
  start: number; // token index in the run
  end: number; // exclusive
  alias: string; // matched (canonical) alias text
  kind: MatchKind;
  name?: string; // display name for merged phrases, e.g. "Chicken Thukpa"
}

interface AliasRec {
  food: FoodEntry;
  tokens: string[];
}

interface SearchRec {
  food: FoodEntry;
  order: number;
  names: string[]; // normalised display-name forms (ranked slightly higher)
  aliases: string[]; // normalised alias forms
}

interface Index {
  exact: Map<string, FoodEntry>;
  maxLen: number;
  vocab: Set<string>;
  fuzzyVocab: string[];
  protectedByFirst: Map<string, string[][]>;
  multi: AliasRec[];
  search: SearchRec[];
}

/** Single-word aliases that usually describe the next dish ("chicken thukpa", "paneer roll", "tandoori momos"). */
const MODIFIERS = new Set([
  "chicken", "murgh", "mutton", "gosht", "keema", "egg", "anda", "fish", "machli", "prawn", "prawns", "jhinga",
  "paneer", "aloo", "gobi", "palak", "methi", "mushroom", "soya", "corn", "sattu", "tandoori", "tofu",
]);
/** Words that separate two dishes inside one name ("paneer tikka with mint chutney"). */
const FIND_CONNECTORS = new Set(["with", "and", "aur", "n", "plus", "or", "saath", "sath"]);
/** Hindi modifier words and their English twins (so "anda bhurji" stays "Egg Bhurji"). */
const MODIFIER_SAME = dict({ anda: "egg", murgh: "chicken", gosht: "mutton", machli: "fish", jhinga: "prawn", prawns: "prawn" });
/** Plain staples eaten alongside a dish — "chicken roti" means chicken curry + roti, not one merged dish. */
const STAPLE_KEYS = new Set([
  "roti", "ghee_roti", "tandoori_roti", "missi_roti", "rice", "brown_rice", "jeera_rice", "naan", "butter_naan", "garlic_naan",
  "pav", "bread_white", "bread_brown", "bajra_roti", "jowar_roti", "ragi_roti", "ragi_mudde", "makki_roti", "puri", "bhatura",
  "kulcha", "appam", "idiyappam", "puttu", "kerala_parotta", "butter_toast",
]);
const NO_MERGE_CATEGORIES = new Set(["drink", "dairy", "fruit", "nuts", "fat", "condiment", "sweet"]);
/** Add-ons that "no / without / bina / less" removes ("chai no sugar", "roti bina ghee"). */
const ADDON_ALIASES = new Set(["sugar", "cheeni", "shakkar", "ghee", "butter", "makhan", "oil", "tel", "cheese", "mayo", "mayonnaise", "honey", "jaggery", "gur", "jam", "ketchup", "sauce", "cream", "malai"]);
/** Raw-veg / sabzi words that, followed by "sabzi", name a home sabzi ("mooli sabzi"). */
const SABZI_HEAD_CATEGORIES = new Set(["salad", "sabzi"]);

const isQtyToken = (t: string) =>
  /^\d/.test(t) || /^\.\d/.test(t) || t in NUM_WORDS || t in PORTIONS || t in SIZE_WORDS || t in NUM_PREFIX;

/** Canonical tokens for an alias or a query: spelling canon, minus fillers, meal-time words and restaurant cues. */
function aliasTokens(s: string): string[] {
  return basicNormalize(s)
    .split(" ")
    .filter(Boolean)
    .map((t) => CANON[t] ?? t)
    .filter((t) => !FILLERS.has(t) && !(t in MEAL_WORDS) && !RESTAURANT_WORDS.has(t));
}

function nameAliases(food: FoodEntry): string[] {
  const out: string[] = [];
  const main = food.name.replace(/\([^)]*\)/g, " ");
  const parts = main.split("/").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) out.push(parts[0]);
  else for (const p of parts) if (p.split(/\s+/).length >= 2) out.push(p);
  out.push(food.key.replace(/_/g, " "));
  return out;
}

let INDEX: Index | null = null;

function index(): Index {
  if (INDEX) return INDEX;
  const exact = new Map<string, FoodEntry>();
  const recs: AliasRec[] = [];
  let maxLen = 1;

  const addAlias = (food: FoodEntry, alias: string) => {
    const tokens = aliasTokens(alias);
    if (!tokens.length) return;
    const key = tokens.join(" ");
    if (exact.has(key)) return; // first food listed wins (FOODS order is the tie-break)
    exact.set(key, food);
    recs.push({ food, tokens });
    maxLen = Math.max(maxLen, tokens.length);
  };

  // Explicit aliases first (they are the intended meaning), then generated name/key forms.
  for (const food of FOODS) for (const a of food.aliases) addAlias(food, a);
  for (const food of FOODS) {
    for (const a of nameAliases(food)) addAlias(food, a);
    if (food.category === "sabzi") {
      for (const a of food.aliases) {
        const toks = aliasTokens(a);
        if (toks.length && toks.length <= 2 && !toks.includes("sabzi")) addAlias(food, `${toks.join(" ")} sabzi`);
      }
    }
  }

  const vocab = new Set<string>();
  const protectedByFirst = new Map<string, string[][]>();
  for (const r of recs) {
    for (const t of r.tokens) vocab.add(t);
    if (r.tokens.some(isQtyToken)) {
      const listFor = protectedByFirst.get(r.tokens[0]) ?? [];
      listFor.push(r.tokens);
      protectedByFirst.set(r.tokens[0], listFor);
    }
  }
  for (const l of protectedByFirst.values()) l.sort((a, b) => b.length - a.length);

  const search: SearchRec[] = FOODS.map((food, order) => {
    const names = new Set<string>();
    const aliases = new Set<string>();
    const nm = basicNormalize(food.name.replace(/\([^)]*\)/g, " "));
    names.add(nm);
    names.add(basicNormalize(food.name));
    for (const a of food.aliases) {
      const n = basicNormalize(a);
      aliases.add(n);
      aliases.add(n.split(" ").map((t) => CANON[t] ?? t).join(" "));
    }
    return { food, order, names: [...names].filter(Boolean), aliases: [...aliases].filter(Boolean) };
  });

  INDEX = {
    exact,
    maxLen,
    vocab,
    fuzzyVocab: [...vocab].filter((t) => t.length >= 4 && /^[a-z]+$/.test(t)),
    protectedByFirst,
    multi: recs.filter((r) => r.tokens.length >= 2),
    search,
  };
  return INDEX;
}

/** Canonical form of one query token: spelling canon, then plural → singular when the singular is a known word. */
export function canonToken(raw: string): string {
  const { vocab } = index();
  const c = CANON[raw] ?? raw;
  if (vocab.has(c) || c.length <= 3 || /\d/.test(c)) return c;
  for (const suffix of ["es", "s"]) {
    if (c.endsWith(suffix)) {
      const s = c.slice(0, -suffix.length);
      const cs = CANON[s] ?? s;
      if (vocab.has(cs)) return cs;
    }
  }
  return c;
}

/**
 * Nearest known word for a misspelt token of ≥5 letters: edit distance ≤2 (≤1 for 5-letter words, so
 * "garam" never becomes "gajar"), and a distance of 2 must keep the first letter.
 */
export function fuzzyToken(t: string): string | null {
  if (t.length < 5 || !/^[a-z]+$/.test(t) || IGNORABLE.has(t) || NEGATIONS.has(t) || FILLERS.has(t)) return null;
  const { fuzzyVocab } = index();
  const maxD = t.length >= 6 ? 2 : 1;
  let best: string | null = null;
  let bestD = maxD + 1;
  for (const v of fuzzyVocab) {
    if (Math.abs(v.length - t.length) > maxD) continue;
    const d = levenshtein(t, v, maxD);
    if (d > maxD || (d === 2 && v[0] !== t[0])) continue;
    if (d < bestD || (d === bestD && best && Math.abs(v.length - t.length) < Math.abs(best.length - t.length))) {
      best = v;
      bestD = d;
    }
  }
  return best;
}

/** Length of a protected alias ("half fry", "chicken 65", "parle g") starting at `i`, else 0. */
export function protectedLength(tokens: string[], i: number): number {
  const cands = index().protectedByFirst.get(tokens[i]);
  if (!cands) return 0;
  for (const c of cands) {
    if (i + c.length > tokens.length) continue;
    let ok = true;
    for (let k = 0; k < c.length; k++) if (tokens[i + k] !== c[k]) { ok = false; break; }
    if (ok) return c.length;
  }
  return 0;
}

export function exactFood(tokens: string[]): FoodEntry | null {
  return index().exact.get(tokens.join(" ")) ?? null;
}

/** Best alias sharing ≥2 words with the phrase in any order ("masala paneer", "paneer makhani masala"). */
function overlapMatch(words: string[]): { food: FoodEntry; matched: number; alias: string } | null {
  const set = new Set(words);
  let best: { food: FoodEntry; matched: number; alias: string; score: number } | null = null;
  for (const r of index().multi) {
    let matched = 0;
    for (const t of new Set(r.tokens)) if (set.has(t)) matched++;
    if (matched < 2 || matched / r.tokens.length < 0.6) continue;
    const score = matched * 2 - (r.tokens.length - matched);
    if (!best || score > best.score) best = { food: r.food, matched, alias: r.tokens.join(" "), score };
  }
  return best ? { food: best.food, matched: best.matched, alias: best.alias } : null;
}

const fixTokens = (words: string[]) => {
  const { vocab } = index();
  let changed = false;
  const fixed = words.map((w) => {
    if (vocab.has(w)) return w;
    const f = fuzzyToken(w);
    if (f) changed = true;
    return f ?? w;
  });
  return { fixed, changed };
};

/**
 * Split a run of food words into foods, left to right, longest alias first.
 * "idli vada sambar" → 3 foods; "masala dosa" → 1; "chicken thukpa" → 1 merged ("Chicken Thukpa").
 */
export function coverRun(words: string[]): FoodMatch[] {
  const ix = index();
  if (!words.length) return [];
  const { fixed } = fixTokens(words);
  let matches: FoodMatch[] = [];

  for (let i = 0; i < fixed.length; ) {
    let found: FoodMatch | null = null;
    for (let len = Math.min(ix.maxLen, fixed.length - i); len >= 1; len--) {
      const key = fixed.slice(i, i + len).join(" ");
      const food = ix.exact.get(key);
      if (food) {
        const fuzzy = words.slice(i, i + len).join(" ") !== key;
        found = { food, start: i, end: i + len, alias: key, kind: fuzzy ? "fuzzy" : "exact" };
        break;
      }
    }
    if (found) {
      const negated = found.end - found.start === 1 && ADDON_ALIASES.has(found.alias) && i > 0 && NEGATIONS.has(fixed[i - 1]);
      if (!negated) matches.push(found);
      i = found.end;
    } else i++;
  }

  // Merge "<modifier> <dish>" chains, "<veg> sabzi" and repeats ("marie biscuits") into one item.
  const merged: FoodMatch[] = [];
  for (const m of matches) {
    const prev = merged[merged.length - 1];
    if (prev && prev.end === m.start) {
      if (prev.food.key === m.food.key) {
        merged[merged.length - 1] = { ...prev, end: m.end, alias: `${prev.alias} ${m.alias}` };
        continue;
      }
      if (MODIFIERS.has(prev.alias) && !STAPLE_KEYS.has(m.food.key) && !NO_MERGE_CATEGORIES.has(m.food.category) && prev.food.key !== m.food.key) {
        merged[merged.length - 1] = {
          food: m.food,
          start: prev.start,
          end: m.end,
          alias: `${prev.alias} ${m.alias}`,
          kind: "merged",
          name: titleCase(fixed.slice(prev.start, m.end).join(" ")),
        };
        continue;
      }
      if (m.alias === "sabzi" && SABZI_HEAD_CATEGORIES.has(prev.food.category) && prev.food.key !== m.food.key) {
        merged[merged.length - 1] = {
          food: m.food,
          start: prev.start,
          end: m.end,
          alias: `${prev.alias} sabzi`,
          kind: "merged",
          name: titleCase(`${fixed.slice(prev.start, prev.end).join(" ")} sabzi`),
        };
        continue;
      }
    }
    merged.push(m);
  }
  // An alias that names the protein/veg ("paneer roll", "chicken korma", "egg sandwich") keeps that name
  // even though it shares a generic entry's nutrition.
  matches = merged.map((m) => {
    if (m.name) return m;
    const aliasToks = m.alias.split(" ");
    if (aliasToks.length < 2) return m;
    const nameToks = new Set(aliasTokens(m.food.name).map((t) => MODIFIER_SAME[t] ?? t));
    return aliasToks.some((t) => MODIFIERS.has(t) && !nameToks.has(MODIFIER_SAME[t] ?? t)) ? { ...m, name: titleCase(m.alias) } : m;
  });

  if (!matches.length && !words.every((w) => IGNORABLE.has(w))) {
    const ov = overlapMatch(fixed);
    if (ov) matches = [{ food: ov.food, start: 0, end: words.length, alias: ov.alias, kind: "overlap" }];
  }
  return matches;
}

/** Query tokens for findFood: canonical, without fillers or quantity words (unless part of a name like "half fry"). */
function queryWords(query: string): string[] {
  const raw = basicNormalize(query).split(" ").filter(Boolean);
  const toks: string[] = [];
  for (const r of raw) {
    const t = canonToken(r);
    if (FILLERS.has(r) || FILLERS.has(t) || r in MEAL_WORDS || RESTAURANT_WORDS.has(t)) continue;
    toks.push(t);
  }
  const out: string[] = [];
  for (let i = 0; i < toks.length; ) {
    const p = protectedLength(toks, i);
    if (p) {
      out.push(...toks.slice(i, i + p));
      i += p;
      continue;
    }
    if (!isQtyToken(toks[i])) out.push(toks[i]);
    i++;
  }
  return out;
}

/** Best single match for a free-text food name (aliases, fuzzy), or null. */
export function findFood(query: string): FoodEntry | null {
  if (typeof query !== "string" || !query.trim()) return null;
  const words = queryWords(query.slice(0, 200));
  if (!words.length) return null;
  const ix = index();
  const direct = ix.exact.get(words.join(" "));
  if (direct) return direct;
  const { fixed } = fixTokens(words);
  const fixedHit = ix.exact.get(fixed.join(" "));
  if (fixedHit) return fixedHit;

  // The first dish mentioned wins ("chicken tikka with mint chutney"). Within that phrase: the longest
  // name, then a real dish over a modifier word, then the last word ("chocolate milkshake" is a milkshake).
  let best: { food: FoodEntry; start: number; len: number; mod: boolean; phrase: number } | null = null;
  let phrase = 0;
  for (let i = 0; i < fixed.length; i++) {
    if (FIND_CONNECTORS.has(fixed[i])) {
      phrase++;
      continue;
    }
    for (let len = Math.min(ix.maxLen, fixed.length - i); len >= 1; len--) {
      const key = fixed.slice(i, i + len).join(" ");
      const food = ix.exact.get(key);
      if (!food) continue;
      const cand = { food, start: i, len, mod: len === 1 && MODIFIERS.has(key), phrase };
      const better =
        !best ||
        cand.phrase < best.phrase ||
        (cand.phrase === best.phrase &&
          (cand.len > best.len || (cand.len === best.len && (best.mod ? true : !cand.mod))));
      if (better) best = cand;
      break;
    }
  }
  const ov = overlapMatch(fixed);
  if (ov && ov.matched > (best?.len ?? 0)) return ov.food;
  return best?.food ?? null;
}

/**
 * Autocomplete score of one name/alias `s` for query `q`:
 * exact 100 › starts with the whole query word(s) ~92 › contains all query words ~86 ›
 * starts with a partial word ~80 › word prefixes ~70 › mid-word substring 45 › typo-tolerant ≤40.
 */
function scoreString(s: string, q: string, qTokens: string[]): number {
  if (s === q) return 100;
  const extra = s.length - q.length;
  if (s.startsWith(`${q} `)) return 92 - Math.min(8, extra / 3);
  const sTokens = s.split(" ");
  if (qTokens.every((qt) => sTokens.includes(qt))) return 86 - Math.min(8, extra / 4);
  if (s.startsWith(q)) return 80 - Math.min(8, extra / 3);
  if (qTokens.every((qt) => sTokens.some((st) => st.startsWith(qt)))) return 70 - Math.min(8, extra / 4);
  if (q.length >= 3 && s.includes(q)) return 45;
  // Typo-tolerant: every query word close to (a prefix of) some word in the name.
  let total = 0;
  for (const qt of qTokens) {
    const allowed = qt.length >= 5 ? 2 : qt.length === 4 ? 1 : 0;
    if (!allowed) return 0;
    let bestD = allowed + 1;
    for (const st of sTokens) {
      const d = Math.min(levenshtein(qt, st, allowed), levenshtein(qt, st.slice(0, qt.length), allowed));
      if (d < bestD) bestD = d;
    }
    if (bestD > allowed) return 0;
    total += bestD;
  }
  return 40 - total * 5;
}

/** Ranked search for autocomplete. */
export function searchFoods(query: string, limit = 8): FoodEntry[] {
  if (typeof query !== "string") return [];
  const q = basicNormalize(query.slice(0, 80));
  if (!q) return [];
  const qCanon = q.split(" ").map((t) => CANON[t] ?? t).join(" ");
  const variants = Array.from(new Set([q, qCanon]));
  const max = Math.max(1, Math.min(50, Math.floor(limit) || 8));

  const scored: { rec: SearchRec; score: number }[] = [];
  for (const rec of index().search) {
    let score = 0;
    for (const v of variants) {
      const vt = v.split(" ");
      for (const n of rec.names) {
        const s = scoreString(n, v, vt);
        if (s > 0) score = Math.max(score, s + 4); // display-name hits rank a little above alias hits
      }
      for (const a of rec.aliases) {
        const s = scoreString(a, v, vt);
        if (s > 0) score = Math.max(score, s === 100 ? 100 : s - 3);
      }
    }
    if (score > 0) scored.push({ rec, score });
  }
  scored.sort((a, b) => b.score - a.score || a.rec.food.name.length - b.rec.food.name.length || a.rec.order - b.rec.order);
  // Once there are real hits, drop the typo/substring tail ("dal" shouldn't list pomegranate juice).
  const floor = scored.length ? Math.max(0, scored[0].score - 40) : 0;
  return scored
    .filter((x) => x.score >= floor)
    .slice(0, max)
    .map((x) => x.rec.food);
}
