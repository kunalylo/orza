/**
 * Allergy / avoid-list matching for every suggestion ÖRZA makes (insights, coach, recipes,
 * rebalance plans). Profile allergies are free text ("Peanuts", "Dairy / lactose", "mushrooms"),
 * so each known allergy expands to the ingredient words that signal it in Indian + global dishes.
 */

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  peanut: ["peanut", "peanuts", "groundnut", "moongphali", "mungfali", "shengdana", "sing dana", "singdana", "peanut butter", "chikki"],
  tree_nut: ["almond", "badam", "cashew", "kaju", "walnut", "akhrot", "pistachio", "pista", "hazelnut", "pecan", "macadamia", "nut", "nuts", "dry fruit", "dry fruits", "praline", "marzipan"],
  dairy: [
    "milk", "doodh", "curd", "dahi", "yogurt", "yoghurt", "paneer", "cheese", "ghee", "butter", "cream", "malai", "khoa", "khoya",
    "mawa", "lassi", "chaas", "buttermilk", "raita", "kheer", "rabdi", "rasmalai", "rasgulla", "kulfi", "ice cream", "shrikhand", "whey", "latte", "chai",
  ],
  gluten: [
    "wheat", "atta", "maida", "roti", "chapati", "phulka", "paratha", "naan", "kulcha", "puri", "bhatura", "bread", "pav", "bun", "pasta",
    "noodle", "noodles", "maggi", "semolina", "suji", "sooji", "rava", "upma", "barley", "jau", "rye", "seitan", "biscuit", "cake", "pizza", "burger", "samosa", "kachori", "dalia",
  ],
  soy: ["soy", "soya", "tofu", "edamame", "tempeh", "soya chunks", "nutrela", "miso"],
  egg: ["egg", "eggs", "anda", "omelette", "omelet", "bhurji", "mayonnaise", "mayo", "meringue"],
  fish: ["fish", "machli", "machhli", "macher", "machher", "salmon", "tuna", "pomfret", "rohu", "surmai", "bangda", "sardine", "hilsa", "ilish", "anchovy"],
  shellfish: ["prawn", "prawns", "jhinga", "shrimp", "crab", "lobster", "oyster", "mussel", "clam", "squid", "kolambi"],
  sesame: ["sesame", "til", "gingelly", "tahini", "tilkut"],
  mustard: ["mustard", "sarson", "rai", "kasundi"],
};

const ALIASES: Array<[RegExp, string]> = [
  [/peanut|groundnut|moongphali/, "peanut"],
  [/tree ?nut|almond|cashew|walnut|pista|nut/, "tree_nut"],
  [/dairy|lactose|milk/, "dairy"],
  [/gluten|wheat|celiac|coeliac/, "gluten"],
  [/soy|soya/, "soy"],
  [/egg/, "egg"],
  [/shellfish|prawn|shrimp|crab|lobster/, "shellfish"],
  [/fish|seafood/, "fish"],
  [/sesame|til\b/, "sesame"],
  [/mustard/, "mustard"],
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ\s]/g, " ").replace(/\s+/g, " ").trim();

/** Expand free-text allergies into lowercase keywords to avoid. Unknown entries ("mushrooms") are used as-is. */
export function allergyKeywords(allergies: string[] | undefined | null): string[] {
  const out = new Set<string>();
  for (const raw of allergies || []) {
    const a = norm(String(raw));
    if (!a || a === "none" || a === "no" || a === "nil") continue;
    let matched = false;
    for (const [re, key] of ALIASES) {
      if (re.test(a)) {
        ALLERGEN_KEYWORDS[key].forEach((k) => out.add(k));
        matched = true;
      }
    }
    // "seafood" means both fish and shellfish
    if (/seafood/.test(a)) ALLERGEN_KEYWORDS.shellfish.forEach((k) => out.add(k));
    if (!matched) {
      out.add(a);
      if (a.endsWith("s") && a.length > 3) out.add(a.slice(0, -1)); // "mushrooms" → "mushroom"
    }
  }
  return [...out];
}

/** True when any of `texts` (dish name, ingredients, aliases…) mentions something on the avoid list. */
export function conflictsWithAllergies(texts: string | string[], allergies: string[] | undefined | null): boolean {
  const keywords = allergyKeywords(allergies);
  if (!keywords.length) return false;
  const hay = ` ${norm(Array.isArray(texts) ? texts.join(" ") : texts)} `;
  return keywords.some((k) => hay.includes(` ${k} `) || (k.includes(" ") && hay.includes(k)));
}

/** Human list for prompts / copy, e.g. "peanuts, dairy". */
export function allergyList(allergies: string[] | undefined | null): string {
  return (allergies || []).filter((a) => a && !/^(none|no|nil)$/i.test(a.trim())).join(", ");
}
