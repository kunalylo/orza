/**
 * Allergy / avoid-list matching for every suggestion ÖRZA makes (insights, coach, recipes,
 * rebalance plans, reports, quick picks). Profile allergies are free text ("Peanuts",
 * "Dairy / lactose", "mushrooms", "peanut allergy"), so each known allergy expands to the
 * ingredient words that signal it in Indian + global dishes, and the user's own words are
 * always kept too ("coconut", "nutmeg", "lentils").
 *
 * Matching is whole-word and plural-tolerant: "cashew" matches "cashews", "roti" matches
 * "rotis", "dairy" matches "dairies" — but "nut" never matches "coconut" / "peanut" / "nutmeg",
 * "egg" never matches "eggplant" and "til" never matches "lentil".
 */
import type { Diet } from "@/lib/types";

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  peanut: ["peanut", "groundnut", "moongphali", "mungfali", "moongfali", "shengdana", "sing dana", "singdana", "peanut butter", "chikki"],
  tree_nut: ["almond", "badam", "cashew", "kaju", "walnut", "akhrot", "pistachio", "pista", "hazelnut", "pecan", "macadamia", "nut", "dry fruit", "praline", "marzipan"],
  dairy: [
    "dairy", "lactose", "milk", "doodh", "dudh", "curd", "dahi", "yogurt", "yoghurt", "paneer", "cheese", "ghee", "butter", "cream", "malai", "khoa", "khoya",
    "mawa", "lassi", "chaas", "buttermilk", "raita", "kheer", "rabdi", "rasmalai", "rasgulla", "kulfi", "ice cream", "shrikhand", "whey", "latte", "chai",
  ],
  gluten: [
    "gluten", "wheat", "gehun", "gehu", "atta", "maida", "roti", "chapati", "phulka", "paratha", "naan", "kulcha", "puri", "bhatura", "bread", "pav", "bun", "pasta",
    "noodle", "maggi", "semolina", "suji", "sooji", "rava", "upma", "barley", "jau", "rye", "seitan", "biscuit", "cake", "pizza", "burger", "samosa", "kachori", "dalia",
    "toast", "rusk", "khakhra", "thepla",
  ],
  soy: ["soy", "soya", "tofu", "edamame", "tempeh", "soya chunks", "nutrela", "miso"],
  egg: ["egg", "anda", "ande", "omelette", "omelet", "mayonnaise", "mayo", "meringue"],
  fish: ["fish", "machli", "machhli", "macher", "machher", "salmon", "tuna", "pomfret", "rohu", "surmai", "bangda", "sardine", "hilsa", "ilish", "anchovy"],
  shellfish: ["shellfish", "prawn", "jhinga", "shrimp", "crab", "lobster", "oyster", "mussel", "clam", "squid", "kolambi"],
  sesame: ["sesame", "til", "gingelly", "tahini", "tilkut"],
  mustard: ["mustard", "sarson", "rai", "kasundi"],
};

/** Free-text allergy → allergen group. Anchored so "coconut", "eggplant" and "lentil" don't map to nuts / egg / sesame. */
const ALIASES: Array<[RegExp, string]> = [
  [/peanut|groundnut|\bmoong ?phali\b|\bmung ?fali\b|\bmoongfali\b|\bshengdana\b/, "peanut"],
  [/\btree ?nuts?\b|almond|cashew|walnut|pistachio|\bpista\b|hazelnut|\bnuts?\b|\bdry ?fruits?\b|\bbadam\b|\bkaju\b|\bakhrot\b/, "tree_nut"],
  [/dairy|lactose|\bmilk\b|\bdoodh\b|\bdudh\b|paneer|\bcurd\b|\bdahi\b|\bcasein\b|\bwhey\b/, "dairy"],
  [/gluten|wheat|celiac|coeliac|\bgehu?n?\b|\batta\b|\bmaida\b/, "gluten"],
  [/\bsoy|\bsoya\b|\btofu\b/, "soy"],
  [/\beggs?\b|\banda\b|\bande\b/, "egg"],
  [/shellfish|\bprawns?\b|\bshrimps?\b|\bcrabs?\b|\blobsters?\b|\bjhinga\b/, "shellfish"],
  [/\bfish\b|seafood|\bmachh?li\b|\bmachh?er\b/, "fish"],
  [/sesame|\btil\b|gingelly/, "sesame"],
  [/mustard|\bsarson\b/, "mustard"],
];

/** Words that describe the allergy rather than the food ("peanut allergy", "lactose intolerant"). */
const FILLER = /\b(?:allerg(?:y|ies|ic)|intoleran(?:t|ce)|sensitiv(?:e|ity)|reaction|to|free|mild|severe|strict)\b/g;

const NONE = /^(?:none|no|nil|na|n a|nothing)$/;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s]/g, " ").replace(/\s+/g, " ").trim();

/** Singular form of an English plural ("mushrooms" → "mushroom", "berries" → "berry", "tomatoes" → "tomato"). */
function singular(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(?:ches|shes|xes|sses|oes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/** Expand free-text allergies into lowercase keywords to avoid. Unknown entries ("mushrooms") are used as-is. */
export function allergyKeywords(allergies: string[] | undefined | null): string[] {
  const out = new Set<string>();
  // "tree nuts, kiwi" / "dairy and eggs" → separate entries so nothing typed by the user is dropped
  const entries = (Array.isArray(allergies) ? allergies : []).flatMap((raw) => String(raw ?? "").split(/,|;|\/|\band\b|&|\+/i));
  for (const raw of entries) {
    const a = norm(raw);
    if (!a || NONE.test(a)) continue;
    for (const [re, key] of ALIASES) {
      if (re.test(a)) ALLERGEN_KEYWORDS[key].forEach((k) => out.add(k));
    }
    // "seafood" means both fish and shellfish
    if (/seafood/.test(a)) ALLERGEN_KEYWORDS.shellfish.forEach((k) => out.add(k));
    // Always keep the user's own words too, so nothing they typed is lost behind an alias.
    const core = a.replace(FILLER, " ").replace(/\s+/g, " ").trim();
    if (core.length >= 2 && !NONE.test(core)) {
      out.add(core);
      const words = core.split(" ");
      const last = singular(words[words.length - 1]);
      out.add([...words.slice(0, -1), last].join(" "));
    }
  }
  return [...out];
}

const WORD_CHARS = "a-z0-9\\u0900-\\u097f";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole-word, plural-tolerant pattern for one keyword ("dry fruit" also matches "dry fruits"). */
function keywordPattern(keyword: string): string {
  const words = keyword.split(" ");
  const last = singular(words.pop() as string);
  const tail = /[^aeiou]y$/.test(last) ? `${esc(last.slice(0, -1))}(?:y|ies)` : `${esc(last)}(?:e?s)?`;
  return [...words.map(esc), tail].join(" ");
}

const matcherCache = new Map<string, RegExp | null>();

/** One compiled regex per avoid-list (callers check many dishes against the same list). */
function matcherFor(allergies: string[] | undefined | null): RegExp | null {
  const key = (Array.isArray(allergies) ? allergies : []).map((a) => String(a ?? "")).join("\u0001");
  if (matcherCache.has(key)) return matcherCache.get(key) ?? null;
  const keywords = allergyKeywords(allergies);
  const re = keywords.length
    ? new RegExp(`(?:^|[^${WORD_CHARS}])(?:${[...new Set(keywords.map(keywordPattern))].join("|")})(?![${WORD_CHARS}])`)
    : null;
  if (matcherCache.size >= 200) matcherCache.clear();
  matcherCache.set(key, re);
  return re;
}

/** True when any of `texts` (dish name, ingredients, aliases…) mentions something on the avoid list. */
export function conflictsWithAllergies(texts: string | string[], allergies: string[] | undefined | null): boolean {
  const re = matcherFor(allergies);
  if (!re) return false;
  const list = Array.isArray(texts) ? texts : [texts];
  return list.some((t) => typeof t === "string" && re.test(norm(t)));
}

/** Human list for prompts / copy, e.g. "peanuts, dairy". */
export function allergyList(allergies: string[] | undefined | null): string {
  return (Array.isArray(allergies) ? allergies : [])
    .filter((a) => typeof a === "string" && a.trim() && !NONE.test(norm(a)))
    .join(", ");
}

/**
 * Everything ÖRZA must never suggest: profile allergies plus avoid-facts learned in chat
 * ("Allergic to …", "Doesn't eat …", "Avoids …", "Dislikes …", "Is lactose/gluten intolerant").
 */
export function avoidList(allergies: string[] | undefined | null, memory: string[] | undefined | null): string[] {
  const out = (Array.isArray(allergies) ? allergies : []).filter((a) => typeof a === "string" && a.trim() && !NONE.test(norm(a)));
  for (const fact of Array.isArray(memory) ? memory : []) {
    if (typeof fact !== "string") continue;
    const f = fact.trim();
    const m = f.match(/^(?:allergic to|(?:doesn't|does not|don't|do not|can't|cannot) eat|avoids|dislikes)\s+(.+)$/i);
    if (m) out.push(m[1]);
    const intolerant = f.match(/^is\s+(lactose|gluten)\s+intolerant\b/i);
    if (intolerant) out.push(intolerant[1].toLowerCase());
  }
  return [...new Set(out)];
}

/**
 * Diets learned in chat ("Is vegan", "Follows a Jain diet", "Eats strictly vegetarian"), so every
 * suggestion can respect them alongside `profile.diet`. "Non-veg" facts are ignored: they never
 * restrict anything.
 */
export function memoryDiets(memory: string[] | undefined | null): Diet[] {
  const out = new Set<Diet>();
  for (const fact of Array.isArray(memory) ? memory : []) {
    if (typeof fact !== "string") continue;
    const f = fact.trim().toLowerCase();
    if (/\bnon[- ]?veg/.test(f)) continue;
    const m = f.match(/^(?:is|follows|eats|keeps)\s+(?:an?\s+)?(?:strict(?:ly)?\s+|pure(?:ly)?\s+|fully\s+)?(vegan|vegetarian|eggetarian|jain|veg)\b/);
    if (!m) continue;
    out.add(m[1] === "vegan" ? "vegan" : m[1] === "jain" ? "jain" : m[1] === "eggetarian" ? "eggetarian" : "vegetarian");
  }
  return [...out];
}

const DIET_STRICTNESS: Record<Diet, number> = { vegan: 0, jain: 1, vegetarian: 2, eggetarian: 3, non_vegetarian: 4 };

/**
 * The diet to plan or parse for: the strictest of `profile.diet` and the diets learned in chat
 * ("Is vegan"), so a restriction someone mentioned to the coach is honoured even before they
 * update their profile. `undefined` when neither says anything.
 */
export function effectiveDiet(profileDiet: Diet | null | undefined, memory: string[] | undefined | null): Diet | undefined {
  const all = [...(profileDiet ? [profileDiet] : []), ...memoryDiets(memory)];
  if (!all.length) return undefined;
  return all.reduce((a, b) => (DIET_STRICTNESS[b] < DIET_STRICTNESS[a] ? b : a));
}

/** A memory fact that food suggestions rely on: something {@link avoidList} or {@link memoryDiets} reads. */
export function isFoodSafetyFact(fact: string): boolean {
  return avoidList([], [fact]).length > 0 || memoryDiets([fact]).length > 0;
}

/**
 * Trim a memory list to `cap` items. The oldest facts go first, but food-safety facts (allergies,
 * avoided foods, diets learned in chat) are kept while anything else can go instead, so a burst of
 * small talk never silently drops "Allergic to cashews" or "Is vegan".
 */
export function capMemory(memory: string[], cap: number): string[] {
  let excess = memory.length - cap;
  if (excess <= 0) return memory;
  const kept = memory.filter((f) => {
    if (excess > 0 && !isFoodSafetyFact(f)) {
      excess--;
      return false;
    }
    return true;
  });
  return kept.slice(-cap);
}
