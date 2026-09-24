/**
 * Deterministic meal parser for English, Hindi and Hinglish — ÖRZA's free fallback when AI is off,
 * and what chat / rebalance use to read a described meal.
 *
 * Pipeline: normalise → detect meal time + restaurant cues → split into phrases on commas/and/aur/with/+ →
 * drop filler words → read quantities & portions → match foods (longest alias first) → size each item.
 */
import type { MealItem, MealType } from "@/lib/types";
import { FOOD_HINTS, FOODS } from "./foods";
import { canonToken, coverRun, exactFood, protectedLength, type FoodMatch } from "./matcher";
import { nutrientsFor } from "./nutrients";
import type { FoodEntry } from "./types";
import {
  CONNECTORS,
  FILLERS,
  IGNORABLE,
  JOINABLE,
  MEAL_WORDS,
  NUM_PREFIX,
  NUM_WORDS,
  NUTRIENT_WORDS,
  PORTION_GRAMS,
  PORTION_NUM_WORDS,
  PORTIONS,
  QUESTION_RE,
  RESTAURANT_WORDS,
  SIZE_WORDS,
  UNIT_KIND,
  WEIGHT_FACTOR,
  dict,
  stripDiacritics,
} from "./text";

const MAX_TEXT = 2000;
const MAX_ITEMS = 20;
const MAX_UNMATCHED = 10;
const MAX_COUNT = 50;
const MAX_GRAMS = 5000;
const ARTICLES = new Set(["a", "an", "the"]);
const EAT_OUT_VERBS = new Set(["ate", "eat", "eating", "eaten", "dine", "dined", "dining", "went", "go", "going"]);
const EGG_WORDS = new Set(["egg", "anda", "eggs"]);
const CONFIDENCE: Record<FoodMatch["kind"], number> = { exact: 0.9, fuzzy: 0.75, merged: 0.7, overlap: 0.6 };
/** Weighed amounts mean the plain ingredient: "200 g paneer" is paneer, "150 g chicken" is chicken breast. */
const WEIGHED_ALIAS = dict({ paneer: "paneer", chicken: "grilled_chicken", murgh: "grilled_chicken" });
const FOOD_BY_KEY = new Map(FOODS.map((f) => [f.key, f]));

const round = (n: number, d = 2) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

interface Qty {
  count: number | null; // from digits / number words (null = not stated)
  portion: string | null; // canonical unit: katori, plate, glass, g …
  size: number; // small/large multiplier
  sizeWord: string | null;
  word: "half" | "full" | "single" | "double" | null; // lone "half"/"full"/… for foods with special meanings
  articleOnly: boolean; // just "a"/"an" — never a meaningful trailing quantity
  raw: string[];
}

type Tok =
  | { kind: "num"; t: string; value: number }
  | { kind: "prefix"; t: string; value: number }
  | { kind: "portion"; t: string; unit: string }
  | { kind: "size"; t: string; value: number }
  | { kind: "word"; t: string };

type Element = { kind: "group"; q: Qty } | { kind: "run"; words: string[]; matches: FoodMatch[] };

/** Normalise raw text but keep separators, decimals (1.5) and fractions (1/2). */
function prep(text: string): string {
  let s = String(text ?? "").slice(0, MAX_TEXT);
  s = s.replace(/½/g, " 1/2 ").replace(/¼/g, " 1/4 ").replace(/¾/g, " 3/4 ").replace(/⅓/g, " 1/3 ").replace(/⅔/g, " 2/3 ");
  s = stripDiacritics(s).toLowerCase().replace(/[’'`]/g, "");
  s = s.replace(/&/g, " and ").replace(/\+/g, " , ");
  s = s.replace(/(\d)(?=[a-z])/g, "$1 ").replace(/([a-z])(?=\d)/g, "$1 ");
  // "one and a half" / "2 and half" → 1.5 / 2.5 (before "and" becomes a separator)
  s = s.replace(/\b(\d+|one|two|three|four|five|ek|do|teen)\s+and\s+(?:a\s+)?half\b/g, (_m, n: string) => ` ${(NUM_WORDS[n] ?? Number(n)) + 0.5} `);
  // Ranges "2-3", "2 to 3", "2 or 3" → the midpoint.
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*(?:-|–|—|to|or|se)\s*(\d+(?:\.\d+)?)\b/g, (m, a: string, b: string) => {
    const x = Number(a);
    const y = Number(b);
    return y > x && y - x <= 10 ? ` ${round((x + y) / 2)} ` : m;
  });
  s = s.replace(/(?<=[a-z])\/|\/(?=[a-z])/g, " , "); // "roti/dal"
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, " , "); // sentence breaks, keeping 1.5
  s = s.replace(/[;:|!?\n\r\t•·]+/g, " , ");
  s = s.replace(/,/g, " , ");
  s = s.replace(/[^a-z0-9.,/ ]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function classify(t: string): Tok {
  if (/^\d+(\.\d+)?$/.test(t) || /^\.\d+$/.test(t)) return { kind: "num", t, value: Number(t) };
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac && Number(frac[2]) > 0) return { kind: "num", t, value: Number(frac[1]) / Number(frac[2]) };
  if (t in NUM_WORDS) return { kind: "num", t, value: NUM_WORDS[t] };
  if (t in NUM_PREFIX) return { kind: "prefix", t, value: NUM_PREFIX[t] };
  if (t in PORTIONS) return { kind: "portion", t, unit: PORTIONS[t] };
  if (t in SIZE_WORDS) return { kind: "size", t, value: SIZE_WORDS[t] };
  return { kind: "word", t };
}

function parseGroup(toks: Tok[]): Qty {
  const nums: { value: number; word: string | null; int: boolean }[] = [];
  let prefix: number | null = null;
  let portion: string | null = null;
  let size = 1;
  let sizeWord: string | null = null;
  for (const tok of toks) {
    if (tok.kind === "num") {
      let v = tok.value;
      if (prefix != null) {
        v += prefix;
        prefix = null;
      }
      nums.push({ value: v, word: /^\d|^\./.test(tok.t) ? null : tok.t, int: Number.isInteger(v) });
    } else if (tok.kind === "prefix") prefix = tok.value;
    else if (tok.kind === "portion") portion = tok.unit;
    else if (tok.kind === "size") {
      size *= tok.value;
      sizeWord = tok.value < 1 ? (tok.value <= 0.6 ? "mini" : "small") : tok.value > 1 ? "large" : sizeWord;
    }
  }
  if (prefix != null) nums.push({ value: prefix < 0 ? 0.75 : 0.5, word: null, int: false }); // lone "paune" / "saade"

  let count: number | null = null;
  if (nums.length === 1) count = nums[0].value;
  else if (nums.length === 2 && nums[0].int && nums[1].value < 1) count = nums[0].value + nums[1].value; // "1 1/2"
  else if (nums.length === 2 && nums[0].int && nums[1].int && nums[1].value === nums[0].value + 1) count = (nums[0].value + nums[1].value) / 2; // "do teen"
  else if (nums.length > 1) count = nums.reduce((p, n) => p * n.value, 1); // "2 half plates"
  if (count != null && !(count > 0)) count = null;

  const lone = nums.length === 1 && nums[0].word ? PORTION_NUM_WORDS[nums[0].word] ?? null : null;
  const articleOnly = !portion && size === 1 && nums.length > 0 && nums.every((n) => n.word === "a" || n.word === "an");
  return { count, portion, size, sizeWord, word: lone, articleOnly, raw: toks.map((t) => t.t) };
}

/** Canonical tokens of one phrase, minus meal-time words, restaurant cues and fillers. */
function cleanTokens(raw: string[], question: boolean): string[] {
  const out: string[] = [];
  for (const r of raw) {
    const t = canonToken(r);
    if (r in MEAL_WORDS || t in MEAL_WORDS) continue;
    if (RESTAURANT_WORDS.has(r) || RESTAURANT_WORDS.has(t)) {
      if (out.length && ARTICLES.has(out[out.length - 1])) out.pop(); // "from a restaurant"
      continue;
    }
    if (FILLERS.has(r) || FILLERS.has(t)) continue;
    if (question && NUTRIENT_WORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

const isQty = (t: string) => classify(t).kind !== "word";

/** Does "<end of a> <connector> <start of b>" spell a known dish ("oats with milk", "mac and cheese")? */
function joinsAsName(a: string[], conn: string, b: string[]): boolean {
  if (b.some(isQty)) return false;
  const coreA = a.filter((t) => !isQty(t));
  for (let k = 0; k < coreA.length; k++) {
    for (let m = 1; m <= b.length; m++) {
      if (exactFood([...coreA.slice(k), conn, ...b.slice(0, m)])) return true;
    }
  }
  return false;
}

function toElements(tokens: string[]): Element[] {
  const toks: Tok[] = [];
  for (let i = 0; i < tokens.length; ) {
    const p = protectedLength(tokens, i); // "half fry", "chicken 65", "parle g" are names, not quantities
    if (p) {
      for (let k = 0; k < p; k++) toks.push({ kind: "word", t: tokens[i + k] });
      i += p;
      continue;
    }
    toks.push(classify(tokens[i]));
    i++;
  }
  const els: Element[] = [];
  let group: Tok[] = [];
  let words: string[] = [];
  const flushGroup = () => {
    if (group.length) els.push({ kind: "group", q: parseGroup(group) });
    group = [];
  };
  const flushRun = () => {
    if (words.length) els.push({ kind: "run", words, matches: coverRun(words) });
    words = [];
  };
  for (const tok of toks) {
    if (tok.kind === "word") {
      flushGroup();
      words.push(tok.t);
    } else {
      flushRun();
      group.push(tok);
    }
  }
  flushGroup();
  flushRun();
  return els;
}

interface Portion {
  servings: number;
  quantity: number;
  unit: string;
  grams?: number; // omitted when the spoken unit has no fixed weight ("1 scoop whey")
}

/** Convert what was said ("half plate", "2 katori", "200 g", "3 egg") into servings of the food. */
function portionFor(food: FoodEntry, q: Qty | undefined, firstWord: string | undefined): Portion {
  const U = food.serving.unit;
  const uKind = UNIT_KIND[U] ?? "count";
  const hints = FOOD_HINTS.get(food.key) ?? {};
  const said = q?.count ?? 1;
  const n = clamp(said, 0.05, MAX_COUNT);
  let servings = n;
  let quantity = n;
  let unit = U;
  let grams: number | null = null;
  let weightBased = false;
  let knownWeight = true;

  if (q?.portion && q.portion in WEIGHT_FACTOR) {
    // "200 g paneer", "250 ml milk" → servings by weight, shown in the food's own unit.
    grams = clamp(said * WEIGHT_FACTOR[q.portion], 1, MAX_GRAMS);
    servings = grams / food.serving.grams;
    quantity = servings;
    weightBased = true;
  } else if (q?.portion) {
    const P = q.portion;
    const pKind = UNIT_KIND[P] ?? "count";
    if (P === U || hints.same?.includes(P)) {
      knownWeight = P === U;
      unit = P; // 1:1 — "2 katori dal", "half plate rice", "ek glass lassi", "1 scoop whey"
    } else if (P === "piece" && hints.pcs) {
      servings = n / hints.pcs; // "3 piece chicken curry", "4 pc momos"
      unit = "piece";
    } else if (pKind === "count") {
      // "1 serving poha", "2 pc roti" — count in the food's own unit
    } else if (P === "plate" && uKind === "count") {
      servings = n * (hints.plate ?? 2); // "1 plate samosa" = 2 samosas
      unit = "plate";
    } else if (pKind === "volume" && uKind === "count") {
      // "1 cup maggi" — a volume word on a counted food: just count it
    } else {
      grams = n * (PORTION_GRAMS[P] ?? food.serving.grams);
      servings = grams / food.serving.grams; // "1 katori rice" = 150 g of a 250 g plate
      unit = P;
    }
  } else if (hints.eggs && q?.count != null && firstWord && EGG_WORDS.has(firstWord)) {
    servings = n / hints.eggs; // "3 egg omelette" = 1.5 two-egg omelettes
    unit = "egg";
  } else if (q?.word && hints.words?.[q.word] != null) {
    servings = hints.words[q.word]!; // "half tandoori" = 2 pieces, "single omelette" = 1 egg
    quantity = hints.eggs ? servings * hints.eggs : servings;
    unit = hints.eggs ? "egg" : U;
  } else if (hints.pcs && uKind === "measure" && q?.count != null && n >= 2) {
    servings = n / hints.pcs; // "6 pani puri", "10 almonds" are pieces
    unit = "piece";
  }

  if (!weightBased && q && q.size !== 1) {
    servings *= q.size;
    if (grams != null) grams *= q.size;
    if (q.sizeWord) unit = `${q.sizeWord} ${unit}`;
  }
  servings = clamp(servings, 0.05, MAX_COUNT);
  return {
    servings,
    quantity: clamp(round(quantity), 0.01, 100),
    unit,
    grams: knownWeight ? Math.round(grams ?? servings * food.serving.grams) : undefined,
  };
}

function buildItem(m: FoodMatch, q: Qty | undefined, runWords: string[], restaurant: boolean): MealItem {
  let food = m.food;
  if (q?.portion && q.portion in WEIGHT_FACTOR && !m.name && WEIGHED_ALIAS[m.alias]) {
    food = FOOD_BY_KEY.get(WEIGHED_ALIAS[m.alias]) ?? food;
  }
  const p = portionFor(food, q, runWords[m.start]);
  const n = nutrientsFor(food, p.servings, restaurant);
  const styled = restaurant && (food.restaurant_multiplier ?? 1) > 1;
  const base = m.name ?? food.name;
  return {
    name: styled ? `${base} (restaurant)` : base,
    quantity: p.quantity,
    unit: p.unit,
    grams: p.grams,
    ...n,
    confidence: round(CONFIDENCE[m.kind] - (styled ? 0.05 : 0)),
  };
}

function unmatchedPhrase(words: string[], q?: Qty): string | null {
  if (words.every((w) => IGNORABLE.has(w) || w.length <= 1)) return null;
  const text = [...(q && !q.articleOnly ? q.raw : []), ...words].join(" ").trim();
  return text.length >= 2 ? text.slice(0, 80) : null;
}

/** Items for one phrase ("2 roti", "chicken biryani full plate", "idli vada sambar"). */
function parsePhrase(tokens: string[], restaurant: boolean): { items: MealItem[]; unmatched: string[] } {
  const els = toElements(tokens);
  const items: MealItem[] = [];
  const unmatched: string[] = [];
  const qtyOf = new Map<FoodMatch, Qty>();

  // "biryani full plate", "roti 2 dal 1" put the quantity after the food.
  const postfix = els.length > 1 && els[0].kind === "run" && els[els.length - 1].kind === "group";
  if (postfix) {
    for (let i = 1; i < els.length; i++) {
      const el = els[i];
      const prev = els[i - 1];
      if (el.kind === "group" && prev.kind === "run" && prev.matches.length && !el.q.articleOnly) qtyOf.set(prev.matches[0], el.q);
    }
    for (const el of els) {
      if (el.kind === "run" && !el.matches.length) {
        const u = unmatchedPhrase(el.words);
        if (u) unmatched.push(u);
      }
    }
  } else {
    let pending: Qty | undefined;
    let last: FoodMatch | undefined;
    for (const el of els) {
      if (el.kind === "group") {
        pending = el.q;
        continue;
      }
      if (el.matches.length) {
        if (pending) qtyOf.set(el.matches[0], pending);
        last = el.matches[el.matches.length - 1];
      } else {
        const u = unmatchedPhrase(el.words, pending);
        if (u) unmatched.push(u);
      }
      pending = undefined;
    }
    if (pending && last && !qtyOf.has(last) && !pending.articleOnly) qtyOf.set(last, pending); // trailing "… dal 1 katori"
  }

  for (const el of els) {
    if (el.kind !== "run") continue;
    for (const m of el.matches) items.push(buildItem(m, qtyOf.get(m), el.words, restaurant));
  }
  return { items, unmatched };
}

/**
 * Parse "aaj maine breakfast mein do paratha aur dahi khaya", "2 roti, 1 katori dal and half plate rice",
 * "had a masala dosa from a restaurant" into items. Understands English/Hindi/Hinglish numbers
 * (ek/do/teen/aadha/dedh/half/one/two/2/1.5/1/2), Indian portions (katori/bowl/plate/half plate/glass/piece/cup/tbsp),
 * meal words (breakfast/nashta, lunch, dinner/raat, snack) and restaurant cues (restaurant/hotel/dhaba/outside/order).
 */
export function parseMealText(text: string): {
  items: MealItem[];
  unmatched: string[];
  mealType?: MealType;
  restaurant: boolean;
} {
  const src = typeof text === "string" ? text : "";
  const prepped = prep(src);
  if (!prepped) return { items: [], unmatched: [], restaurant: false };
  const question = QUESTION_RE.test(stripDiacritics(src.slice(0, MAX_TEXT)).toLowerCase());
  const tokens = prepped.split(" ").filter(Boolean);

  // Meal time (explicit meal names beat time-of-day words) and restaurant cues, from the whole text.
  let explicitMeal: MealType | undefined;
  let timeMeal: MealType | undefined;
  let restaurant = false;
  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    const t = canonToken(raw);
    const mw = MEAL_WORDS[raw] ?? MEAL_WORDS[t];
    if (mw) {
      if (mw.tier === 1 && !explicitMeal) explicitMeal = mw.meal;
      if (mw.tier === 2 && !timeMeal) timeMeal = mw.meal;
    }
    if (RESTAURANT_WORDS.has(raw) || RESTAURANT_WORDS.has(t)) restaurant = true;
    if (raw === "out" && i > 0 && EAT_OUT_VERBS.has(tokens[i - 1])) restaurant = true; // "ate out"
  }

  // Split into phrases on commas / and / aur / with / plus …, remembering the connector.
  const phrases: { toks: string[]; join: string | null }[] = [];
  let cur: string[] = [];
  let join: string | null = null;
  const push = () => {
    const toks = cleanTokens(cur, question);
    if (toks.length) phrases.push({ toks, join });
    cur = [];
  };
  for (const raw of tokens) {
    if (CONNECTORS.has(raw)) {
      push();
      join = raw === "n" || raw === "aur" || raw === "te" ? "and" : raw;
      continue;
    }
    cur.push(raw);
  }
  push();

  // Re-join phrases that together name one dish: "oats with milk", "chai with sugar", "mac and cheese".
  const merged: string[][] = [];
  for (let i = 0; i < phrases.length; i++) {
    let toks = phrases[i].toks;
    while (i + 1 < phrases.length) {
      const next = phrases[i + 1];
      if (!next.join || !JOINABLE.has(next.join) || !joinsAsName(toks, next.join, next.toks)) break;
      toks = [...toks, next.join, ...next.toks];
      i++;
    }
    merged.push(toks);
  }

  const items: MealItem[] = [];
  const unmatched: string[] = [];
  for (const toks of merged) {
    const r = parsePhrase(toks, restaurant);
    items.push(...r.items);
    unmatched.push(...r.unmatched);
  }

  return {
    items: items.slice(0, MAX_ITEMS),
    unmatched: Array.from(new Set(unmatched)).slice(0, MAX_UNMATCHED),
    mealType: explicitMeal ?? timeMeal,
    restaurant,
  };
}
