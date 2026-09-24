/**
 * ÖRZA curated recipe library — the deterministic (no-API-key) path for
 * personalised recipes, plus the diet/allergen checks used to vet AI recipes.
 *
 * Nutrition is per serving, home-style (IFCT/USDA-based estimates).
 * Diet, Jain-compatibility and allergens are DERIVED from the ingredient text,
 * so the tags can never drift out of sync with what's actually in the dish.
 */
import type { Diet, MealType, Nutrients, Recipe } from "@/lib/types";

/* ───────────────────────────── Types ───────────────────────────── */

export type RecipeDiet = "vegan" | "vegetarian" | "eggetarian" | "non_vegetarian";
export type RegionGroup = "north-indian" | "south-indian" | "west-indian" | "east-indian" | "global";
export type Allergen = "peanuts" | "tree nuts" | "dairy" | "gluten" | "soy" | "eggs" | "fish" | "shellfish" | "sesame";

export interface LibraryRecipe {
  key: string;
  title: string;
  cuisine: string;
  description: string;
  prep_minutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  nutrition: Nutrients; // per serving
  tags: string[];
  diet: RecipeDiet;
  jain: boolean;
  allergens: Allergen[];
  meals: MealType[];
  region: RegionGroup;
}

type Seed = {
  key: string;
  title: string;
  cuisine: string;
  region: RegionGroup;
  meals: MealType[];
  description: string;
  prep_minutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  /** [calories, protein_g, carbs_g, fat_g, fiber_g] per serving */
  n: [number, number, number, number, number];
  tags?: string[];
};

/* ───────────────────────── Keyword vocabulary ───────────────────────── */

const MEAT = [
  "chicken", "mutton", "lamb", "goat", "beef", "pork", "bacon", "ham", "sausage", "salami", "pepperoni", "turkey", "duck",
  "venison", "veal", "meat", "meatball", "keema", "kheema", "qeema", "liver", "gelatin", "gelatine", "lard", "bone broth",
  "prosciutto", "chorizo", "murgh", "gosht",
];
const MEAT_SAFE = ["soya keema", "soy keema", "veg keema", "vegetable keema", "meat masala", "goat cheese", "goats cheese", "goat's cheese", "goat milk", "oyster mushroom"];

const FISH = [
  "fish", "salmon", "tuna", "sardine", "mackerel", "pomfret", "surmai", "rohu", "katla", "hilsa", "ilish", "anchovy", "anchovies",
  "basa", "cod", "tilapia", "bangda", "trout", "haddock", "bombil", "snapper", "halibut",
];
const SHELLFISH = ["shellfish", "prawn", "shrimp", "crab", "lobster", "squid", "calamari", "clam", "mussel", "oyster", "scallop", "kolambi", "jhinga", "jheenga", "crayfish"];

const EGG = ["egg", "anda", "omelette", "omelet", "mayonnaise", "mayo", "meringue", "frittata"];
const EGG_SAFE = ["egg-free", "egg free", "eggless", "no egg", "egg replacer", "flax egg", "chia egg"];

const DAIRY = [
  "milk", "curd", "yogurt", "yoghurt", "dahi", "paneer", "cheese", "ghee", "butter", "buttermilk", "cream", "malai", "khoa", "khoya",
  "mawa", "chhena", "chenna", "chaas", "lassi", "whey", "raita", "kefir", "labneh", "feta", "mozzarella", "parmesan", "ricotta",
  "cheddar", "halloumi", "mascarpone", "rabri", "shrikhand", "casein",
];
const DAIRY_SAFE = [
  "coconut milk", "almond milk", "soy milk", "soya milk", "oat milk", "rice milk", "cashew milk", "peanut butter", "almond butter",
  "cashew butter", "nut butter", "cocoa butter", "coconut cream", "cashew cream", "vegan butter", "vegan cheese", "vegan yogurt",
  "vegan curd", "plant-based milk", "plant milk", "dairy-free", "dairy free", "coconut yogurt", "bean curd", "soy curd", "cream of tartar",
];

const JAIN_AVOID = [
  "onion", "garlic", "potato", "aloo", "carrot", "gajar", "beetroot", "beet", "chukandar", "radish", "mooli", "turnip", "shalgam",
  "ginger", "adrak", "sweet potato", "shakarkandi", "yam", "suran", "jimikand", "arbi", "colocasia", "taro", "shallot",
  "spring onion", "scallion", "leek", "chive", "mushroom", "honey", "pyaz", "pyaaz", "kanda", "lehsun", "lahsun",
  "fresh turmeric", "turmeric root", "cassava",
];
const JAIN_SAFE = ["dry ginger", "dried ginger", "ginger powder", "sonth", "saunth", "onion seeds", "onion-free", "garlic-free", "no onion", "no garlic"];

const ALLERGEN_WORDS: Record<Allergen, { words: string[]; safe?: string[] }> = {
  peanuts: { words: ["peanut", "groundnut", "moongphali", "moongfali", "mungfali"] },
  "tree nuts": {
    words: [
      "almond", "cashew", "walnut", "pistachio", "hazelnut", "pecan", "pine nut", "macadamia", "brazil nut", "badam", "kaju",
      "akhrot", "pista", "chironji", "praline", "marzipan",
    ],
  },
  dairy: { words: DAIRY, safe: DAIRY_SAFE },
  gluten: {
    words: [
      "wheat", "atta", "maida", "rava", "semolina", "sooji", "suji", "barley", "rye", "bread", "breadcrumb", "roti", "chapati",
      "chapatti", "phulka", "paratha", "thepla", "naan", "kulcha", "pasta", "spaghetti", "macaroni", "noodle", "couscous", "bulgur",
      "seitan", "dalia", "daliya", "soy sauce", "oat", "oatmeal", "tortilla", "pita", "bun", "vermicelli", "sevai", "semiya",
      "seviyan", "cracker", "biscuit", "malt", "farro", "spelt",
    ],
    safe: ["rice noodle", "rice vermicelli", "corn tortilla"],
  },
  soy: { words: ["soy", "soya", "soybean", "tofu", "edamame", "tempeh", "miso"] },
  eggs: { words: EGG, safe: EGG_SAFE },
  fish: { words: FISH },
  shellfish: { words: SHELLFISH, safe: ["oyster mushroom"] },
  sesame: { words: ["sesame", "til", "tahini", "gingelly"] },
};

/** How users (and onboarding) name allergies → canonical allergens. */
const ALLERGY_ALIASES: Record<string, Allergen[]> = {
  peanut: ["peanuts"], peanuts: ["peanuts"], groundnut: ["peanuts"], groundnuts: ["peanuts"], moongphali: ["peanuts"],
  "tree nuts": ["tree nuts"], "tree nut": ["tree nuts"], nuts: ["tree nuts", "peanuts"], nut: ["tree nuts", "peanuts"],
  almonds: ["tree nuts"], almond: ["tree nuts"], cashews: ["tree nuts"], cashew: ["tree nuts"], walnuts: ["tree nuts"],
  dairy: ["dairy"], milk: ["dairy"], lactose: ["dairy"], "dairy / lactose": ["dairy"], paneer: ["dairy"],
  gluten: ["gluten"], wheat: ["gluten"], coeliac: ["gluten"], celiac: ["gluten"],
  soy: ["soy"], soya: ["soy"],
  eggs: ["eggs"], egg: ["eggs"],
  fish: ["fish"], seafood: ["fish", "shellfish"],
  shellfish: ["shellfish"], prawn: ["shellfish"], prawns: ["shellfish"], shrimp: ["shellfish"], crab: ["shellfish"],
  sesame: ["sesame"], til: ["sesame"],
};

/* ───────────────────────────── Matching helpers ───────────────────────────── */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ");

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reCache = new Map<string, RegExp>();
/** Whole-word match that tolerates simple plurals ("egg" → "eggs", "potato" → "potatoes"). */
function wordRe(w: string) {
  let re = reCache.get(w);
  if (!re) {
    re = new RegExp(`(^|[^a-z])${esc(w)}(e?s)?(?![a-z])`);
    reCache.set(w, re);
  }
  return re;
}
const strip = (text: string, phrases: string[] = []) => phrases.reduce((t, p) => t.split(p).join(" "), text);
const hasAny = (text: string, words: string[], safe?: string[]) => {
  const t = strip(text, safe);
  return words.some((w) => wordRe(w).test(t));
};

/** Singular-ish stem for free-text allergies ("mushrooms" → "mushroom", "tomatoes" → "tomato"). */
function stem(w: string) {
  const s = norm(w).replace(/^allergic to\s+/, "").replace(/[^a-z\s-]/g, "").trim();
  if (s.length > 4 && s.endsWith("oes")) return s.slice(0, -2);
  if (s.length > 4 && /(ches|shes|xes|sses)$/.test(s)) return s.slice(0, -2);
  if (s.length > 3 && s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

/** Split profile allergies into canonical allergens + free-text foods to avoid. */
export function normalizeAllergies(list: string[] = []): { canon: Allergen[]; custom: string[] } {
  const canon = new Set<Allergen>();
  const custom = new Set<string>();
  for (const raw of list) {
    const a = norm(String(raw || "")).trim();
    if (!a || a === "none") continue;
    const mapped = ALLERGY_ALIASES[a];
    if (mapped) mapped.forEach((m) => canon.add(m));
    else {
      const s = stem(a);
      if (s.length >= 3) custom.add(s);
    }
  }
  return { canon: [...canon], custom: [...custom] };
}

const ingredientText = (ingredients: string[], title = "") => norm(`${title} | ${ingredients.join(" | ")}`);

/** Derive diet class + Jain compatibility from ingredient text. */
export function detectDiet(ingredients: string[]): { diet: RecipeDiet; jain: boolean } {
  const text = norm(ingredients.join(" | "));
  const meat = hasAny(text, MEAT, MEAT_SAFE) || hasAny(text, FISH) || hasAny(text, SHELLFISH, ["oyster mushroom"]);
  const egg = hasAny(text, EGG, EGG_SAFE);
  const animal = hasAny(text, DAIRY, DAIRY_SAFE) || hasAny(text, ["honey"]);
  const diet: RecipeDiet = meat ? "non_vegetarian" : egg ? "eggetarian" : animal ? "vegetarian" : "vegan";
  const jain = (diet === "vegan" || diet === "vegetarian") && !hasAny(text, JAIN_AVOID, JAIN_SAFE);
  return { diet, jain };
}

export function detectAllergens(ingredients: string[]): Allergen[] {
  const text = norm(ingredients.join(" | "));
  return (Object.keys(ALLERGEN_WORDS) as Allergen[]).filter((a) => hasAny(text, ALLERGEN_WORDS[a].words, ALLERGEN_WORDS[a].safe));
}

/** Can someone following `want` eat a dish of this diet class? (vegan ⊂ vegetarian ⊂ eggetarian ⊂ non-veg; Jain is its own rule.) */
export function dietAllows(want: Diet, recipe: { diet: RecipeDiet; jain: boolean }) {
  switch (want) {
    case "vegan":
      return recipe.diet === "vegan";
    case "vegetarian":
      return recipe.diet === "vegan" || recipe.diet === "vegetarian";
    case "eggetarian":
      return recipe.diet !== "non_vegetarian";
    case "jain":
      return recipe.jain;
    default:
      return true;
  }
}

const DIET_WORDS: Record<Diet, string> = {
  vegan: "vegan",
  vegetarian: "vegetarian",
  eggetarian: "eggetarian",
  non_vegetarian: "non-vegetarian",
  jain: "Jain",
};

/**
 * Everything wrong with a recipe for this person (empty = safe).
 * Used to vet AI recipes before they're shown and to filter the library.
 */
export function recipeViolations(
  recipe: { title?: string; ingredients: string[] },
  opts: { diets?: Diet[]; allergies?: string[] }
): string[] {
  const out: string[] = [];
  const d = detectDiet(recipe.ingredients);
  for (const want of opts.diets || []) if (!dietAllows(want, d)) out.push(`not ${DIET_WORDS[want]}`);
  const { canon, custom } = normalizeAllergies(opts.allergies);
  const found = detectAllergens(recipe.ingredients);
  for (const a of canon) if (found.includes(a)) out.push(`contains ${a}`);
  const text = ingredientText(recipe.ingredients, recipe.title);
  for (const c of custom) if (wordRe(c).test(text)) out.push(`contains ${c}`);
  return out;
}

/* ───────────────────────────── Tags ───────────────────────────── */

const slug = (s: string) =>
  norm(s)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const DIET_TAGS = ["vegan", "vegetarian", "eggetarian", "non_vegetarian", "jain"] as const;

/** Diet + nutrition-derived tags (quick, high-protein, low-carb …) shared by library and AI recipes. */
export function deriveTags(input: { ingredients: string[]; nutrition: Nutrients; prep_minutes: number }): string[] {
  const { diet, jain } = detectDiet(input.ingredients);
  const allergens = detectAllergens(input.ingredients);
  const n = input.nutrition;
  const proteinShare = n.calories > 0 ? (n.protein_g * 4) / n.calories : 0;
  const tags: string[] = [];
  if (diet === "vegan") tags.push("vegan", "vegetarian");
  else if (diet === "vegetarian") tags.push("vegetarian");
  else tags.push(diet);
  if (jain) tags.push("jain");
  if (n.protein_g >= 20 || (n.protein_g >= 15 && proteinShare >= 0.25)) tags.push("high-protein");
  if (n.carbs_g <= 20) tags.push("low-carb");
  if (n.calories <= 250) tags.push("low-calorie");
  if (n.fiber_g >= 8) tags.push("high-fibre");
  if (input.prep_minutes <= 20) tags.push("quick");
  if (!allergens.includes("gluten")) tags.push("gluten-free");
  if (!allergens.includes("dairy")) tags.push("dairy-free");
  return tags;
}

/* ───────────────────────────── Library ───────────────────────────── */

const SEEDS: Seed[] = [
  {
    key: "moong-dal-chilla",
    title: "Moong Dal Chilla",
    cuisine: "Rajasthani",
    region: "north-indian",
    meals: ["breakfast", "snack"],
    description: "Soft, savoury lentil pancakes that keep you full till lunch. No onion or garlic, so they're naturally Jain-friendly.",
    prep_minutes: 25,
    servings: 2,
    ingredients: [
      "¾ cup yellow moong dal, soaked 3–4 hours",
      "1 small tomato, finely chopped",
      "2 tbsp fresh coriander, chopped",
      "1 green chilli, finely chopped",
      "½ tsp cumin seeds",
      "¼ tsp dry ginger powder (sonth)",
      "A pinch of hing (asafoetida)",
      "¼ tsp turmeric",
      "Salt to taste",
      "2 tsp oil for the pan",
    ],
    steps: [
      "Drain the soaked dal and grind with the green chilli and ¼ cup water to a smooth, pourable batter.",
      "Stir in cumin, dry ginger powder, hing, turmeric, salt, tomato and coriander.",
      "Heat a non-stick tawa, smear a few drops of oil and pour a ladle of batter, spreading it into a thin round.",
      "Cook on medium heat for 2 minutes until the edges lift, flip and cook 1 more minute.",
      "Repeat with the remaining batter and serve hot with green chutney or curd.",
    ],
    n: [300, 18, 45, 5.5, 6],
    tags: ["tiffin"],
  },
  {
    key: "paneer-bhurji",
    title: "Paneer Bhurji",
    cuisine: "Punjabi",
    region: "north-indian",
    meals: ["breakfast", "dinner"],
    description: "Crumbled paneer tossed with onion, tomato and warm spices — ready in 15 minutes and rich in protein.",
    prep_minutes: 15,
    servings: 2,
    ingredients: [
      "200 g paneer, crumbled",
      "1 medium onion, finely chopped",
      "1 tomato, chopped",
      "1 green chilli, chopped",
      "½ tsp ginger-garlic paste",
      "¼ tsp turmeric",
      "½ tsp garam masala",
      "1 tsp oil",
      "2 tbsp fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Heat oil in a pan and sauté the onion until translucent.",
      "Add ginger-garlic paste and green chilli; cook for 30 seconds.",
      "Add tomato, turmeric and salt; cook until the tomato softens.",
      "Stir in the crumbled paneer and garam masala and cook for 2–3 minutes — don't overcook or it turns rubbery.",
      "Finish with coriander and serve with a multigrain roti or on its own.",
    ],
    n: [322, 20, 10, 23, 2],
  },
  {
    key: "palak-paneer",
    title: "Palak Paneer (light, curd-finished)",
    cuisine: "Punjabi",
    region: "north-indian",
    meals: ["lunch", "dinner"],
    description: "Silky spinach gravy with soft paneer cubes, finished with curd instead of cream to keep it light.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "250 g spinach (palak), blanched",
      "150 g paneer, cubed",
      "1 onion, chopped",
      "1 tomato, chopped",
      "3 garlic cloves",
      "1-inch piece ginger",
      "1 green chilli",
      "½ tsp cumin seeds",
      "½ tsp garam masala",
      "2 tbsp curd, whisked",
      "2 tsp oil",
      "Salt to taste",
    ],
    steps: [
      "Blend the blanched spinach with the green chilli into a smooth purée.",
      "Heat oil, crackle the cumin, then sauté onion, garlic and ginger until golden.",
      "Add tomato and cook until soft, then stir in the spinach purée and salt; simmer 5 minutes.",
      "Take the pan off the heat for a moment and stir in the whisked curd so it doesn't split.",
      "Add paneer and garam masala, simmer 2 minutes and serve with roti or rice.",
    ],
    n: [215, 12.5, 11, 14, 3.5],
  },
  {
    key: "rajma-masala",
    title: "Rajma Masala",
    cuisine: "Punjabi",
    region: "north-indian",
    meals: ["lunch", "dinner"],
    description: "Comforting kidney beans in an onion–tomato masala — a fibre-rich Sunday classic.",
    prep_minutes: 45,
    servings: 4,
    ingredients: [
      "1 cup rajma (kidney beans), soaked overnight",
      "2 onions, finely chopped",
      "3 tomatoes, puréed",
      "1 tbsp ginger-garlic paste",
      "2 green chillies, slit",
      "1 tsp cumin seeds",
      "1 tsp coriander powder",
      "1 tsp Kashmiri chilli powder",
      "½ tsp garam masala",
      "1 tbsp oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Pressure-cook the soaked rajma with salt and 3 cups water for 6–7 whistles until very soft.",
      "Heat oil, crackle cumin, and cook the onions until deep golden.",
      "Add ginger-garlic paste and green chillies, then the tomato purée and powdered spices; cook until oil separates.",
      "Add the rajma with its cooking liquid, mash a few beans to thicken, and simmer 10 minutes.",
      "Finish with garam masala and coriander. Serve with a small bowl of rice or a roti.",
    ],
    n: [230, 12, 35, 5, 9],
    tags: ["one-pot", "comfort"],
  },
  {
    key: "amritsari-chole",
    title: "Amritsari Chole",
    cuisine: "Punjabi",
    region: "north-indian",
    meals: ["lunch"],
    description: "Dark, tangy chickpea curry with a whisper of tea for colour — full of plant protein and fibre.",
    prep_minutes: 45,
    servings: 4,
    ingredients: [
      "1 cup kabuli chana (chickpeas), soaked overnight",
      "1 tea bag or 1 tsp tea leaves tied in muslin",
      "2 onions, finely chopped",
      "2 tomatoes, chopped",
      "1 tbsp ginger-garlic paste",
      "1½ tsp chole masala",
      "½ tsp amchur (dry mango powder)",
      "1 tsp cumin seeds",
      "1 tbsp oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Pressure-cook the chickpeas with the tea bag, salt and water for 5–6 whistles; discard the tea bag.",
      "Heat oil, crackle cumin and sauté onions until browned.",
      "Add ginger-garlic paste, tomatoes, chole masala and amchur; cook to a thick masala.",
      "Add the chickpeas with some cooking liquid and simmer 10–12 minutes, mashing a few for body.",
      "Garnish with coriander and serve with onion rings and lemon.",
    ],
    n: [235, 10, 33, 7.5, 9],
    tags: ["one-pot"],
  },
  {
    key: "dal-tadka",
    title: "Dal Tadka",
    cuisine: "North Indian",
    region: "north-indian",
    meals: ["lunch", "dinner"],
    description: "Everyday toor dal with a sizzling garlic–cumin tadka. Simple, soothing and protein-rich.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "¾ cup toor (arhar) dal, rinsed",
      "1 onion, finely chopped",
      "1 tomato, chopped",
      "3 garlic cloves, sliced",
      "1 green chilli",
      "¼ tsp turmeric",
      "1 tsp cumin seeds",
      "2 dried red chillies",
      "1 tsp ghee + 1 tsp oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Pressure-cook the dal with turmeric, salt and 2½ cups water for 4 whistles; whisk smooth.",
      "Heat oil, sauté onion until soft, add tomato and green chilli and cook until mushy.",
      "Pour in the dal, adjust consistency with water and simmer 5 minutes.",
      "For the tadka, heat ghee, add cumin, garlic and red chillies until the garlic turns golden.",
      "Pour the tadka over the dal, add coriander and serve with rice or roti.",
    ],
    n: [225, 11.5, 36, 4, 8],
    tags: ["comfort"],
  },
  {
    key: "kanda-poha",
    title: "Kanda Poha",
    cuisine: "Maharashtrian",
    region: "west-indian",
    meals: ["breakfast"],
    description: "Fluffy flattened rice with onions, curry leaves and crunchy peanuts — Maharashtra's favourite quick breakfast.",
    prep_minutes: 20,
    servings: 2,
    ingredients: [
      "1½ cups thick poha (flattened rice)",
      "1 onion, finely chopped",
      "2 tbsp peanuts",
      "1 green chilli, chopped",
      "8–10 curry leaves",
      "½ tsp mustard seeds",
      "¼ tsp turmeric",
      "½ tsp sugar (optional)",
      "1 tsp lemon juice",
      "2 tsp oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Rinse the poha in a colander, drain and let it soften for 5 minutes; toss with salt, sugar and turmeric.",
      "Heat oil and roast the peanuts until crunchy; remove and keep aside.",
      "In the same oil, crackle mustard seeds, add curry leaves, green chilli and onion; sauté until soft.",
      "Add the poha, mix gently and steam covered on low heat for 2 minutes.",
      "Finish with lemon juice, roasted peanuts and coriander.",
    ],
    n: [280, 6, 42, 9.5, 3],
  },
  {
    key: "idli-sambar",
    title: "Idli with Sambar",
    cuisine: "Tamil",
    region: "south-indian",
    meals: ["breakfast"],
    description: "Steamed rice-and-urad idlis with a vegetable-packed sambar — light, fermented and gut-friendly.",
    prep_minutes: 35,
    servings: 2,
    ingredients: [
      "6 idlis (from fermented rice–urad batter)",
      "½ cup toor dal",
      "1 cup mixed vegetables (drumstick, pumpkin, brinjal)",
      "6 shallots (sambar onions)",
      "1 tomato, chopped",
      "1 tbsp tamarind pulp",
      "1½ tsp sambar powder",
      "½ tsp mustard seeds",
      "8 curry leaves",
      "A pinch of hing",
      "2 tsp oil",
      "Salt to taste",
    ],
    steps: [
      "Steam the idlis in a greased idli stand for 10–12 minutes.",
      "Pressure-cook the toor dal until soft and mash well.",
      "Boil the vegetables, shallots and tomato with tamarind, sambar powder, salt and 1½ cups water until tender.",
      "Add the mashed dal and simmer 5 minutes.",
      "Temper mustard seeds, curry leaves and hing in oil, pour over the sambar and serve with hot idlis.",
    ],
    n: [330, 12, 58, 5.5, 7],
  },
  {
    key: "pesarattu",
    title: "Pesarattu (Green Moong Dosa)",
    cuisine: "Andhra",
    region: "south-indian",
    meals: ["breakfast"],
    description: "Crisp Andhra dosa made from whole green moong — no fermentation, lots of plant protein.",
    prep_minutes: 25,
    servings: 2,
    ingredients: [
      "¾ cup whole green moong, soaked overnight",
      "1-inch piece ginger",
      "2 green chillies",
      "½ tsp cumin seeds",
      "1 small onion, finely chopped (for topping)",
      "2 tbsp fresh coriander",
      "2 tsp oil",
      "Salt to taste",
    ],
    steps: [
      "Grind the soaked moong with ginger, green chillies, cumin, salt and a little water into a thick batter.",
      "Heat a tawa, pour a ladle of batter and spread thin.",
      "Sprinkle chopped onion and coriander, drizzle oil around the edges.",
      "Cook until the base is golden and crisp, fold and serve with ginger chutney.",
    ],
    n: [295, 17.5, 46, 5.5, 11],
  },
  {
    key: "rava-upma",
    title: "Vegetable Rava Upma",
    cuisine: "Karnataka",
    region: "south-indian",
    meals: ["breakfast"],
    description: "Roasted semolina cooked with vegetables and a crackling tempering — a 20-minute South Indian staple.",
    prep_minutes: 20,
    servings: 2,
    ingredients: [
      "¾ cup roasted rava (semolina)",
      "1 small onion, chopped",
      "½ cup mixed vegetables (carrot, peas, beans), finely chopped",
      "1 green chilli, slit",
      "½-inch piece ginger, grated",
      "½ tsp mustard seeds",
      "1 tsp chana dal",
      "1 tsp urad dal",
      "8 curry leaves",
      "2 tsp oil",
      "2¼ cups water",
      "Lemon juice and coriander to finish",
      "Salt to taste",
    ],
    steps: [
      "Heat oil, add mustard seeds, chana dal and urad dal and fry until the dals turn golden.",
      "Add curry leaves, ginger, green chilli and onion; sauté 2 minutes, then add the vegetables.",
      "Pour in the water with salt and bring to a rolling boil.",
      "Lower the heat and add rava in a thin stream, stirring constantly to avoid lumps.",
      "Cover and cook 2 minutes, then finish with lemon juice and coriander.",
    ],
    n: [290, 8.5, 51, 5.5, 5],
  },
  {
    key: "kerala-meen-curry",
    title: "Kerala Meen Curry",
    cuisine: "Kerala",
    region: "south-indian",
    meals: ["lunch", "dinner"],
    description: "Tangy red fish curry soured with kudampuli and a splash of coconut milk — lean protein, big flavour.",
    prep_minutes: 35,
    servings: 3,
    ingredients: [
      "400 g firm fish (seer/surmai or pomfret), cut in pieces",
      "2 pieces kudampuli (Malabar tamarind), soaked",
      "8 shallots, sliced",
      "1-inch piece ginger, julienned",
      "4 garlic cloves, sliced",
      "2 green chillies, slit",
      "10 curry leaves",
      "1½ tbsp Kashmiri chilli powder",
      "¼ tsp turmeric",
      "½ tsp fenugreek seeds",
      "½ cup thin coconut milk",
      "1 tbsp coconut oil",
      "Salt to taste",
    ],
    steps: [
      "Heat coconut oil in a clay pot or pan, crackle fenugreek seeds and add curry leaves.",
      "Sauté shallots, ginger, garlic and green chillies until soft.",
      "Lower the heat and add chilli powder and turmeric with a splash of water; cook to a paste.",
      "Add the kudampuli with its water, salt and 1 cup water; bring to a boil.",
      "Slide in the fish, simmer 8–10 minutes without stirring, then add coconut milk and swirl the pot gently.",
    ],
    n: [245, 26, 6, 12.5, 2],
  },
  {
    key: "chicken-tikka",
    title: "Tandoori-style Chicken Tikka",
    cuisine: "Punjabi",
    region: "north-indian",
    meals: ["lunch", "dinner"],
    description: "Yoghurt-marinated chicken grilled with peppers and onions — high protein, low carb, all smoky flavour.",
    prep_minutes: 35,
    servings: 3,
    ingredients: [
      "500 g boneless chicken breast, cubed",
      "½ cup hung curd",
      "1 tbsp ginger-garlic paste",
      "1 tsp Kashmiri chilli powder",
      "1 tsp garam masala",
      "½ tsp kasuri methi",
      "1 tbsp lemon juice",
      "1 tbsp mustard oil",
      "1 onion and 1 capsicum, cut in chunks",
      "Salt to taste",
    ],
    steps: [
      "Whisk hung curd with ginger-garlic paste, spices, kasuri methi, lemon juice, mustard oil and salt.",
      "Coat the chicken, onion and capsicum and marinate for at least 30 minutes (or overnight in the fridge).",
      "Thread onto skewers and grill, air-fry or bake at 220 °C for 15–18 minutes, turning once.",
      "Rest 2 minutes and serve with mint chutney and a big salad.",
    ],
    n: [300, 40, 8, 11, 2],
  },
  {
    key: "masala-egg-bhurji",
    title: "Masala Egg Bhurji",
    cuisine: "Maharashtrian",
    region: "west-indian",
    meals: ["breakfast", "dinner"],
    description: "Mumbai street-style scrambled eggs with onion, tomato and a pinch of pav bhaji masala.",
    prep_minutes: 15,
    servings: 2,
    ingredients: [
      "6 eggs",
      "1 onion, finely chopped",
      "1 tomato, chopped",
      "1 green chilli, chopped",
      "¼ tsp turmeric",
      "½ tsp pav bhaji masala",
      "2 tsp oil",
      "2 tbsp fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Heat oil and sauté onion and green chilli until soft.",
      "Add tomato, turmeric, pav bhaji masala and salt; cook until the tomato breaks down.",
      "Crack in the eggs and stir continuously on low heat until softly set.",
      "Finish with coriander and serve with a multigrain toast or roti.",
    ],
    n: [285, 19, 6.5, 19.5, 1.5],
  },
  {
    key: "dimer-jhol",
    title: "Dimer Jhol (Bengali Egg Curry)",
    cuisine: "Bengali",
    region: "east-indian",
    meals: ["lunch", "dinner"],
    description: "Boiled eggs and potato in a light, mustard-oil scented Bengali gravy.",
    prep_minutes: 30,
    servings: 2,
    ingredients: [
      "4 eggs, boiled and peeled",
      "1 potato, cut in wedges",
      "1 onion, puréed",
      "1 tomato, puréed",
      "1 tsp ginger paste",
      "1 bay leaf",
      "½ tsp cumin powder",
      "½ tsp turmeric",
      "1 tsp Kashmiri chilli powder",
      "1 tbsp mustard oil",
      "½ tsp garam masala",
      "Salt to taste",
    ],
    steps: [
      "Rub the eggs and potato with a pinch of turmeric and salt; lightly fry in half the oil and set aside.",
      "In the remaining oil, add the bay leaf and onion purée; cook until golden.",
      "Add ginger paste, tomato purée and the powdered spices; cook until the masala leaves the sides.",
      "Add the potatoes with 1½ cups water and simmer until tender.",
      "Add the eggs and garam masala, simmer 3 minutes and serve with rice.",
    ],
    n: [275, 14, 16, 17, 3],
  },
  {
    key: "macher-jhol",
    title: "Macher Jhol (Light Bengali Fish Stew)",
    cuisine: "Bengali",
    region: "east-indian",
    meals: ["lunch", "dinner"],
    description: "A thin, homely fish stew with kalonji and green chillies — how Bengal eats fish on a weeknight.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "450 g rohu or katla fish steaks",
      "1 tsp turmeric (for the marinade and curry)",
      "1 potato, cut in long pieces",
      "1 tomato, chopped",
      "1 tsp ginger paste",
      "½ tsp cumin powder",
      "½ tsp kalonji (nigella seeds)",
      "2 green chillies, slit",
      "1 tbsp mustard oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Marinate the fish with half the turmeric and salt for 10 minutes; sear lightly in mustard oil and set aside.",
      "In the same oil, splutter kalonji and green chillies, then add the potato and fry 2 minutes.",
      "Add ginger paste, cumin, remaining turmeric and tomato; cook until soft.",
      "Pour in 2 cups water and simmer until the potato is tender.",
      "Slip in the fish, simmer 5 minutes and finish with coriander.",
    ],
    n: [220, 26, 10, 7.5, 2],
  },
  {
    key: "goan-prawn-curry",
    title: "Goan Prawn Curry",
    cuisine: "Goan",
    region: "west-indian",
    meals: ["lunch", "dinner"],
    description: "Prawns simmered in a bright coconut–red chilli masala with a tamarind tang.",
    prep_minutes: 35,
    servings: 3,
    ingredients: [
      "300 g prawns, cleaned and deveined",
      "½ cup grated coconut",
      "4 dried Kashmiri chillies",
      "1 tsp coriander seeds",
      "½ tsp cumin seeds",
      "4 garlic cloves",
      "1 small onion, chopped",
      "1 tomato, chopped",
      "1 tbsp tamarind pulp",
      "1 tbsp coconut oil",
      "Salt to taste",
    ],
    steps: [
      "Grind coconut, dried chillies, coriander, cumin and garlic with water to a smooth masala.",
      "Heat coconut oil and sauté the onion until soft, then add the tomato.",
      "Add the ground masala and 1 cup water; simmer 8 minutes.",
      "Add tamarind and salt, then the prawns; cook 4–5 minutes until just pink and curled.",
      "Rest 5 minutes before serving with a small portion of rice.",
    ],
    n: [215, 21, 9, 10, 2.5],
  },
  {
    key: "hyderabadi-chicken-biryani",
    title: "Home-style Hyderabadi Chicken Biryani",
    cuisine: "Hyderabadi",
    region: "south-indian",
    meals: ["lunch", "dinner"],
    description: "A lighter home version of the classic — more chicken, less ghee, all the aroma.",
    prep_minutes: 60,
    servings: 4,
    ingredients: [
      "1 cup basmati rice, soaked 30 minutes",
      "400 g boneless chicken thigh, cut in pieces",
      "½ cup curd",
      "1 onion, thinly sliced and pan-browned",
      "1 tbsp ginger-garlic paste",
      "1 tsp biryani masala",
      "½ tsp Kashmiri chilli powder",
      "Whole spices: 1 bay leaf, 3 cloves, 3 cardamom, 1-inch cinnamon",
      "A handful of mint and coriander",
      "1 tbsp ghee",
      "A pinch of saffron in 2 tbsp warm milk",
      "Salt to taste",
    ],
    steps: [
      "Marinate chicken with curd, ginger-garlic paste, biryani masala, chilli powder, half the browned onion, mint and salt for 30 minutes.",
      "Boil the rice with whole spices and salt until 70% cooked; drain.",
      "Spread the chicken in a heavy pot and cook covered on medium heat for 10 minutes.",
      "Layer the rice over the chicken, top with saffron milk, ghee, remaining onion and herbs.",
      "Seal with a lid and cook on the lowest heat for 20 minutes. Rest 5 minutes before gently mixing.",
    ],
    n: [355, 25, 40, 10, 1.5],
    tags: ["one-pot", "festive"],
  },
  {
    key: "moong-dal-khichdi",
    title: "Moong Dal Khichdi",
    cuisine: "Gujarati",
    region: "west-indian",
    meals: ["lunch", "dinner"],
    description: "One-pot rice and moong dal with bottle gourd and peas — gentle on the stomach, and Jain-friendly.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "½ cup rice",
      "½ cup yellow moong dal",
      "1 cup chopped lauki (bottle gourd)",
      "¼ cup green peas",
      "1 tomato, chopped",
      "1 tsp cumin seeds",
      "A pinch of hing",
      "½ tsp turmeric",
      "1 tbsp ghee",
      "4 cups water",
      "Salt to taste",
    ],
    steps: [
      "Rinse the rice and dal together and soak for 15 minutes.",
      "Heat ghee in a pressure cooker, add cumin and hing, then the tomato, lauki and peas.",
      "Add the rice, dal, turmeric, salt and water.",
      "Pressure-cook for 3–4 whistles and let the pressure release naturally.",
      "Stir to a soft, porridge-like consistency and serve with curd or kadhi.",
    ],
    n: [300, 12, 50, 5.5, 5],
    tags: ["one-pot", "comfort"],
  },
  {
    key: "moong-sprouts-chaat",
    title: "Moong Sprouts Chaat",
    cuisine: "North Indian",
    region: "north-indian",
    meals: ["snack", "breakfast"],
    description: "A crunchy, tangy bowl of steamed sprouts and fresh vegetables — ready in 10 minutes.",
    prep_minutes: 10,
    servings: 2,
    ingredients: [
      "2 cups sprouted green moong, lightly steamed",
      "1 onion, finely chopped",
      "1 tomato, chopped",
      "½ cucumber, chopped",
      "1 green chilli, finely chopped",
      "1 tsp chaat masala",
      "½ tsp roasted cumin powder",
      "Juice of 1 lemon",
      "2 tbsp fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Steam the sprouts for 4–5 minutes so they stay crunchy; cool slightly.",
      "Toss with onion, tomato, cucumber and green chilli.",
      "Season with chaat masala, cumin, salt and lemon juice.",
      "Garnish with coriander and eat right away.",
    ],
    n: [160, 10, 27, 1.5, 7],
  },
  {
    key: "ragi-dosa",
    title: "Instant Ragi Dosa",
    cuisine: "Karnataka",
    region: "south-indian",
    meals: ["breakfast"],
    description: "Lacy finger-millet dosas that need no fermentation — earthy, filling and Jain-friendly.",
    prep_minutes: 20,
    servings: 2,
    ingredients: [
      "¾ cup ragi (finger millet) flour",
      "¼ cup rice flour",
      "2 tbsp curd",
      "1 green chilli, finely chopped",
      "½ tsp cumin seeds",
      "8 curry leaves, chopped",
      "2 tbsp fresh coriander",
      "2 tsp oil",
      "Salt to taste",
      "Water for a thin batter",
    ],
    steps: [
      "Whisk ragi flour, rice flour, curd, salt and water into a thin, pourable batter; rest 10 minutes.",
      "Stir in cumin, green chilli, curry leaves and coriander.",
      "Heat a tawa and pour the batter from the edges inwards to make a lacy dosa.",
      "Drizzle oil, cook until crisp at the edges and serve with coconut chutney.",
    ],
    n: [272, 5, 48, 6, 5.5],
  },
  {
    key: "avial",
    title: "Avial",
    cuisine: "Kerala",
    region: "south-indian",
    meals: ["lunch"],
    description: "Mixed vegetables in a coconut–curd sauce with fresh curry leaves and a drizzle of coconut oil.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "3 cups mixed vegetables cut in batons (ash gourd, raw banana, carrot, beans, drumstick, yam)",
      "½ cup grated coconut",
      "2 green chillies",
      "1 tsp cumin seeds",
      "¼ tsp turmeric",
      "¼ cup thick curd, whisked",
      "10 curry leaves",
      "1 tbsp coconut oil",
      "Salt to taste",
    ],
    steps: [
      "Cook the vegetables with turmeric, salt and ½ cup water until just tender.",
      "Coarsely grind coconut, green chillies and cumin without water.",
      "Add the coconut paste to the vegetables and cook 3 minutes.",
      "Take off the heat, fold in the curd, then add curry leaves and coconut oil.",
    ],
    n: [160, 3.5, 16, 9.5, 5],
  },
  {
    key: "cabbage-thoran",
    title: "Cabbage Thoran",
    cuisine: "Kerala",
    region: "south-indian",
    meals: ["lunch"],
    description: "Finely shredded cabbage stir-fried with coconut, shallots and curry leaves — ready in 15 minutes.",
    prep_minutes: 15,
    servings: 3,
    ingredients: [
      "4 cups finely shredded cabbage",
      "½ cup grated coconut",
      "2 green chillies",
      "4 shallots",
      "1 garlic clove",
      "½ tsp mustard seeds",
      "1 tsp urad dal",
      "10 curry leaves",
      "¼ tsp turmeric",
      "2 tsp coconut oil",
      "Salt to taste",
    ],
    steps: [
      "Crush coconut, green chillies, shallots, garlic and turmeric into a coarse mix.",
      "Heat coconut oil, splutter mustard seeds, add urad dal and curry leaves.",
      "Add the cabbage and salt, cover and cook 4 minutes on medium heat.",
      "Stir in the coconut mix, cook uncovered 2–3 minutes and serve.",
    ],
    n: [115, 2.5, 11, 7.5, 4],
  },
  {
    key: "baingan-bharta",
    title: "Baingan Bharta",
    cuisine: "Punjabi",
    region: "north-indian",
    meals: ["dinner", "lunch"],
    description: "Smoky fire-roasted brinjal mashed with onion, tomato and mustard oil.",
    prep_minutes: 35,
    servings: 3,
    ingredients: [
      "1 large brinjal (about 500 g), fire-roasted",
      "1 onion, finely chopped",
      "2 tomatoes, chopped",
      "3 garlic cloves, chopped",
      "1 green chilli, chopped",
      "½-inch piece ginger, grated",
      "½ tsp cumin seeds",
      "½ tsp coriander powder",
      "½ tsp Kashmiri chilli powder",
      "1 tbsp mustard oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Roast the brinjal directly on a flame until charred and soft; cool, peel and mash.",
      "Heat mustard oil until it just smokes, cool slightly and crackle the cumin.",
      "Sauté onion, garlic, ginger and green chilli until golden.",
      "Add tomatoes and spices and cook until soft, then fold in the mashed brinjal and salt.",
      "Cook 5 minutes, garnish with coriander and serve with roti.",
    ],
    n: [115, 2.5, 16, 5, 6.5],
  },
  {
    key: "soya-chunks-masala",
    title: "Soya Chunks Masala",
    cuisine: "North Indian",
    region: "north-indian",
    meals: ["lunch", "dinner"],
    description: "Juicy soya chunks and peas in a quick onion–tomato masala — one of the richest vegan protein sources.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "2 cups (about 120 g) soya chunks",
      "1 onion, chopped",
      "2 tomatoes, puréed",
      "1 tsp ginger-garlic paste",
      "½ cup green peas",
      "1 tsp coriander powder",
      "½ tsp garam masala",
      "½ tsp Kashmiri chilli powder",
      "1 tbsp oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Soak the soya chunks in hot salted water for 10 minutes; squeeze out the water.",
      "Heat oil, sauté onion until golden and add ginger-garlic paste.",
      "Add tomato purée and spices; cook until the oil separates.",
      "Add soya chunks, peas and ½ cup water; simmer covered for 8 minutes.",
      "Finish with garam masala and coriander.",
    ],
    n: [225, 22.5, 23, 5, 8],
  },
  {
    key: "chettinad-pepper-chicken",
    title: "Chettinad Pepper Chicken",
    cuisine: "Tamil",
    region: "south-indian",
    meals: ["dinner", "lunch"],
    description: "A dry, peppery Chettinad fry with fennel and curry leaves — protein-packed and low in carbs.",
    prep_minutes: 35,
    servings: 3,
    ingredients: [
      "500 g boneless chicken, cut in pieces",
      "1½ tsp freshly crushed black pepper",
      "1 tsp fennel seeds",
      "1 tsp cumin seeds",
      "10 shallots, sliced",
      "1 tbsp ginger-garlic paste",
      "1 tomato, chopped",
      "12 curry leaves",
      "¼ tsp turmeric",
      "1 tbsp sesame (gingelly) oil",
      "Salt to taste",
    ],
    steps: [
      "Dry-roast fennel and cumin and crush coarsely with the black pepper.",
      "Heat the oil, add curry leaves and shallots and sauté until golden.",
      "Add ginger-garlic paste, tomato and turmeric; cook until soft.",
      "Add the chicken and salt, cover and cook 12–15 minutes.",
      "Add the crushed spice mix and roast uncovered until dry and glossy.",
    ],
    n: [275, 37, 7, 10.5, 1.5],
  },
  {
    key: "masor-tenga",
    title: "Masor Tenga (Assamese Tangy Fish Curry)",
    cuisine: "Assamese",
    region: "east-indian",
    meals: ["lunch", "dinner"],
    description: "A light, sour fish curry from Assam made with ripe tomatoes and lemon — minimal oil, maximum freshness.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "450 g rohu fish pieces",
      "3 ripe tomatoes, chopped",
      "1 tbsp lemon juice",
      "½ tsp turmeric",
      "2 green chillies, slit",
      "½ tsp fenugreek seeds",
      "1 tbsp mustard oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Rub the fish with turmeric and salt and sear lightly in mustard oil; set aside.",
      "In the same oil, add fenugreek seeds and green chillies.",
      "Add tomatoes and cook until completely mushy.",
      "Pour in 1½ cups water, bring to a boil and add the fish; simmer 6–7 minutes.",
      "Finish with lemon juice and coriander.",
    ],
    n: [200, 26, 6, 7, 1.5],
  },
  {
    key: "namkeen-sattu-sharbat",
    title: "Namkeen Sattu Sharbat",
    cuisine: "Bihari",
    region: "east-indian",
    meals: ["breakfast", "snack"],
    description: "Bihar's cooling roasted-gram drink — a 5-minute protein and fibre boost for hot mornings.",
    prep_minutes: 5,
    servings: 1,
    ingredients: [
      "4 tbsp (about 40 g) roasted chana sattu",
      "1 glass (250 ml) chilled water",
      "Juice of ½ lemon",
      "¼ tsp roasted cumin powder",
      "¼ tsp black salt",
      "A few mint leaves",
      "1 small green chilli, finely chopped (optional)",
    ],
    steps: [
      "Whisk the sattu into a little water to make a lump-free paste.",
      "Add the rest of the water, lemon juice, cumin and black salt; whisk well.",
      "Stir in mint and green chilli and serve chilled.",
    ],
    n: [155, 9, 25, 2.3, 6],
  },
  {
    key: "khaman-dhokla",
    title: "Khaman Dhokla",
    cuisine: "Gujarati",
    region: "west-indian",
    meals: ["breakfast", "snack"],
    description: "Spongy steamed gram-flour squares with a mustard–curry leaf tempering. Light, tangy and Jain-friendly.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "1 cup besan (gram flour)",
      "¾ cup water",
      "1 tbsp lemon juice",
      "1 tsp sugar",
      "1 green chilli, crushed",
      "¼ tsp turmeric",
      "A pinch of hing",
      "1 tsp fruit salt (or ½ tsp baking soda)",
      "Tempering: 2 tsp oil, 1 tsp mustard seeds, 1 tsp sesame seeds, 8 curry leaves, 2 slit green chillies",
      "2 tbsp fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Whisk besan, water, lemon juice, sugar, green chilli, turmeric, hing and salt into a smooth batter; rest 10 minutes.",
      "Grease a tin and bring water to a boil in a steamer.",
      "Stir the fruit salt into the batter until frothy and pour into the tin immediately.",
      "Steam on high for 15 minutes, until a knife comes out clean; cool 5 minutes and cut into squares.",
      "Heat oil, crackle mustard and sesame seeds with curry leaves and chillies, add 3 tbsp water and pour over the dhokla.",
    ],
    n: [165, 7, 19, 5.5, 3.5],
  },
  {
    key: "jain-paneer-tikka",
    title: "Jain Paneer Tikka",
    cuisine: "North Indian",
    region: "north-indian",
    meals: ["snack", "dinner"],
    description: "Char-grilled paneer, capsicum and tomato in a hung-curd marinade — no onion, no garlic, all flavour.",
    prep_minutes: 30,
    servings: 2,
    ingredients: [
      "200 g paneer, cut in cubes",
      "½ cup hung curd",
      "1 tsp Kashmiri chilli powder",
      "½ tsp roasted cumin powder",
      "½ tsp garam masala",
      "½ tsp kasuri methi",
      "1 tbsp besan, dry-roasted",
      "1 tbsp lemon juice",
      "1 capsicum, cut in squares",
      "1 tomato, deseeded and cut in squares",
      "2 tsp mustard oil",
      "Chaat masala to finish",
      "Salt to taste",
    ],
    steps: [
      "Whisk hung curd with the spices, kasuri methi, roasted besan, lemon juice, mustard oil and salt.",
      "Fold in paneer, capsicum and tomato; marinate 20 minutes.",
      "Thread onto skewers and grill, air-fry or pan-sear until charred at the edges.",
      "Sprinkle chaat masala and serve with mint–coriander chutney.",
    ],
    n: [405, 24.5, 14, 28.5, 2.5],
  },
  {
    key: "gujarati-kadhi-rice",
    title: "Gujarati Kadhi with Rice",
    cuisine: "Gujarati",
    region: "west-indian",
    meals: ["lunch", "dinner"],
    description: "Sweet-sour curd and besan kadhi with a clove–cinnamon tempering, served over steamed rice.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "1 cup curd (slightly sour)",
      "2 tbsp besan",
      "2½ cups water",
      "1 tsp jaggery",
      "1 green chilli, crushed",
      "¾ cup rice, for serving",
      "Tempering: 1 tsp ghee, ½ tsp mustard seeds, ½ tsp cumin, 2 cloves, 1-inch cinnamon, 8 curry leaves, a pinch of hing",
      "2 tbsp fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Cook the rice with 2 cups water until fluffy.",
      "Whisk curd, besan and water until completely smooth.",
      "Bring to a boil on medium heat, stirring constantly, then add jaggery, green chilli and salt; simmer 10 minutes.",
      "Heat ghee, add the tempering spices and curry leaves and pour into the kadhi.",
      "Garnish with coriander and serve over the rice.",
    ],
    n: [263, 8, 46, 5, 1.5],
    tags: ["comfort"],
  },
  {
    key: "curd-rice",
    title: "Curd Rice (Thayir Sadam)",
    cuisine: "Tamil",
    region: "south-indian",
    meals: ["lunch"],
    description: "Cooling curd rice with a crackling tempering and pomegranate — soothing, probiotic and Jain-friendly.",
    prep_minutes: 15,
    servings: 2,
    ingredients: [
      "1½ cups cooked rice, slightly mashed",
      "1 cup curd",
      "¼ cup milk",
      "½ tsp mustard seeds",
      "1 tsp urad dal",
      "1 green chilli, chopped",
      "8 curry leaves",
      "A pinch of hing",
      "2 tbsp pomegranate arils",
      "1 tsp oil",
      "Fresh coriander",
      "Salt to taste",
    ],
    steps: [
      "Mix the cooled rice with curd, milk and salt until creamy.",
      "Heat oil, add mustard seeds and urad dal and fry until golden.",
      "Add green chilli, curry leaves and hing, then pour the tempering over the rice.",
      "Top with pomegranate and coriander. Serve cool.",
    ],
    n: [280, 9, 44, 7.5, 1.5],
  },
  {
    key: "kosambari",
    title: "Kosambari (Karnataka Moong Salad)",
    cuisine: "Karnataka",
    region: "south-indian",
    meals: ["snack", "lunch"],
    description: "A crunchy temple-style salad of soaked moong dal, cucumber and coconut. Vegan and Jain-friendly.",
    prep_minutes: 10,
    servings: 2,
    ingredients: [
      "⅓ cup yellow moong dal, soaked 2 hours and drained",
      "1 cucumber, finely chopped",
      "2 tbsp grated coconut",
      "1 green chilli, finely chopped",
      "Juice of 1 lemon",
      "2 tbsp fresh coriander",
      "Tempering: 1 tsp oil, ½ tsp mustard seeds, a pinch of hing, 6 curry leaves",
      "Salt to taste",
    ],
    steps: [
      "Toss the drained moong dal with cucumber, coconut and green chilli.",
      "Heat oil, crackle mustard seeds, add hing and curry leaves and pour over the salad.",
      "Add salt and lemon juice just before serving so it stays crunchy.",
      "Garnish with coriander.",
    ],
    n: [170, 8.5, 23, 5, 4],
  },
  {
    key: "roasted-masala-makhana",
    title: "Roasted Masala Makhana",
    cuisine: "Bihari",
    region: "east-indian",
    meals: ["snack"],
    description: "Crunchy fox nuts roasted in a teaspoon of ghee with chaat masala — a light, satisfying evening snack.",
    prep_minutes: 10,
    servings: 2,
    ingredients: [
      "2 cups (about 40 g) makhana (fox nuts)",
      "2 tsp ghee",
      "¼ tsp turmeric",
      "½ tsp chaat masala",
      "¼ tsp Kashmiri chilli powder",
      "¼ tsp black pepper",
      "Salt to taste",
    ],
    steps: [
      "Dry-roast the makhana on low heat for 6–8 minutes until they crush easily between your fingers.",
      "Add ghee and turmeric and toss for 1 minute.",
      "Turn off the heat and sprinkle chaat masala, chilli, pepper and salt.",
      "Cool completely and store in an airtight jar.",
    ],
    n: [115, 2, 15, 5, 3],
  },
  {
    key: "methi-thepla",
    title: "Methi Thepla",
    cuisine: "Gujarati",
    region: "west-indian",
    meals: ["breakfast", "lunch"],
    description: "Soft fenugreek flatbreads that travel well — Gujarat's favourite tiffin and travel food.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "1 cup whole wheat atta",
      "2 tbsp besan",
      "1 cup fresh methi (fenugreek) leaves, chopped",
      "3 tbsp curd",
      "½ tsp turmeric",
      "1 tsp red chilli powder",
      "½ tsp ajwain",
      "1 tsp sesame seeds",
      "A pinch of hing",
      "2 tsp oil in the dough + 2 tsp for roasting",
      "Salt to taste",
    ],
    steps: [
      "Mix atta, besan, methi, spices, sesame seeds, salt, curd and 2 tsp oil.",
      "Knead into a soft dough with a little water; rest 10 minutes.",
      "Divide into 6 balls and roll each into a thin round.",
      "Cook on a hot tawa with a few drops of oil until golden spots appear on both sides.",
    ],
    n: [235, 7, 33, 8, 5.5],
    tags: ["tiffin"],
  },
  {
    key: "ven-pongal",
    title: "Ven Pongal",
    cuisine: "Tamil",
    region: "south-indian",
    meals: ["breakfast"],
    description: "Peppery rice-and-moong porridge tempered in ghee with cumin, ginger and cashews.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "½ cup raw rice",
      "¼ cup yellow moong dal, dry-roasted",
      "3 cups water",
      "1 tbsp ghee",
      "1 tsp black pepper, coarsely crushed",
      "1 tsp cumin seeds",
      "1-inch piece ginger, finely chopped",
      "8 cashews",
      "10 curry leaves",
      "A pinch of hing",
      "Salt to taste",
    ],
    steps: [
      "Pressure-cook rice and moong dal with water and salt for 4 whistles; mash lightly.",
      "Heat ghee, fry the cashews until golden.",
      "Add pepper, cumin, ginger, curry leaves and hing; sizzle for 30 seconds.",
      "Pour the tempering over the pongal, mix and serve hot with coconut chutney.",
    ],
    n: [245, 7, 37, 7, 2],
    tags: ["comfort"],
  },
  {
    key: "oats-kheer",
    title: "Oats Kheer with Jaggery",
    cuisine: "North Indian",
    region: "north-indian",
    meals: ["snack"],
    description: "A creamy cardamom kheer sweetened with jaggery — dessert that still brings protein and fibre.",
    prep_minutes: 20,
    servings: 2,
    ingredients: [
      "¼ cup rolled oats",
      "2 cups toned milk",
      "1½ tbsp jaggery powder",
      "4 cardamom pods, crushed",
      "A pinch of saffron",
      "1 tbsp chopped almonds and pistachios",
    ],
    steps: [
      "Dry-roast the oats for 2 minutes until fragrant.",
      "Bring the milk to a boil, add oats and simmer 8–10 minutes, stirring often.",
      "Add cardamom and saffron and cook 2 more minutes.",
      "Turn off the heat, let it cool slightly and stir in jaggery (so the milk doesn't split).",
      "Top with chopped nuts and serve warm or chilled.",
    ],
    n: [265, 10.5, 31, 11.5, 2],
    tags: ["dessert", "sweet"],
  },
  {
    key: "foxtail-millet-pulao",
    title: "Foxtail Millet Vegetable Pulao",
    cuisine: "Andhra",
    region: "south-indian",
    meals: ["lunch", "dinner"],
    description: "A fragrant pulao made with foxtail millet (korra) instead of rice — more fibre, same comfort.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "¾ cup foxtail millet (korra), rinsed and soaked 20 minutes",
      "1 onion, sliced",
      "1 cup mixed vegetables (carrot, beans, peas)",
      "1 tsp ginger-garlic paste",
      "Whole spices: 1 bay leaf, 2 cloves, 2 cardamom, 1-inch cinnamon",
      "1 green chilli, slit",
      "2 tsp oil",
      "A handful of mint and coriander",
      "1¾ cups water",
      "Salt to taste",
    ],
    steps: [
      "Heat oil in a pressure cooker and add the whole spices.",
      "Sauté onion until golden, then add ginger-garlic paste, green chilli and the vegetables.",
      "Add the drained millet, mint, salt and water.",
      "Pressure-cook for 2 whistles and rest 10 minutes before fluffing with a fork.",
    ],
    n: [225, 7.5, 37, 5, 6.5],
    tags: ["millet", "one-pot"],
  },
  {
    key: "greek-yogurt-overnight-oats",
    title: "Greek Yogurt Overnight Oats",
    cuisine: "Continental",
    region: "global",
    meals: ["breakfast"],
    description: "A no-cook, make-ahead jar of oats, yogurt, chia and banana — 5 minutes the night before.",
    prep_minutes: 5,
    servings: 1,
    ingredients: [
      "⅓ cup rolled oats (30 g)",
      "½ cup Greek yogurt or thick hung curd (100 g)",
      "¼ cup milk",
      "2 tsp chia seeds",
      "½ banana, sliced",
      "1 tbsp chopped almonds",
      "1 tsp honey or jaggery powder",
      "A pinch of cinnamon",
    ],
    steps: [
      "Stir oats, yogurt, milk, chia seeds, cinnamon and honey together in a jar.",
      "Cover and refrigerate overnight (or at least 4 hours).",
      "In the morning, loosen with a splash of milk if needed.",
      "Top with banana and almonds and eat chilled.",
    ],
    n: [400, 18, 51, 15.5, 8],
    tags: ["make-ahead"],
  },
  {
    key: "mediterranean-chickpea-salad",
    title: "Mediterranean Chickpea Salad",
    cuisine: "Mediterranean",
    region: "global",
    meals: ["lunch"],
    description: "Chickpeas, cucumber, tomato and olives in a lemon–olive oil dressing. Keeps well for lunchboxes.",
    prep_minutes: 15,
    servings: 2,
    ingredients: [
      "1½ cups cooked chickpeas (kabuli chana)",
      "1 cucumber, diced",
      "1 tomato, diced",
      "½ red onion, finely chopped",
      "¼ cup chopped parsley or coriander",
      "8 black olives, sliced",
      "1 tbsp extra-virgin olive oil",
      "Juice of 1 lemon",
      "½ tsp dried oregano",
      "Salt and pepper to taste",
    ],
    steps: [
      "Whisk olive oil, lemon juice, oregano, salt and pepper in a large bowl.",
      "Add chickpeas, cucumber, tomato, onion and olives; toss well.",
      "Fold in the herbs and rest 10 minutes so the flavours soak in.",
    ],
    n: [310, 12, 40, 12, 11],
    tags: ["tiffin"],
  },
  {
    key: "tofu-vegetable-stir-fry",
    title: "Tofu & Vegetable Stir-fry",
    cuisine: "East Asian",
    region: "global",
    meals: ["dinner", "lunch"],
    description: "Golden tofu and crisp vegetables in a garlicky soy glaze — a fast, high-protein vegan dinner.",
    prep_minutes: 20,
    servings: 2,
    ingredients: [
      "200 g firm tofu, pressed and cubed",
      "2 cups mixed vegetables (broccoli, bell peppers, beans, mushrooms)",
      "3 garlic cloves, sliced",
      "1-inch piece ginger, julienned",
      "2 spring onions, sliced",
      "1½ tbsp light soy sauce",
      "1 tsp rice vinegar",
      "1 tsp sesame oil + 2 tsp neutral oil",
      "1 tsp cornflour mixed in 3 tbsp water",
      "1 tsp sesame seeds",
      "Chilli flakes to taste",
    ],
    steps: [
      "Pan-sear the tofu in the neutral oil until golden on all sides; set aside.",
      "In the same pan, stir-fry garlic, ginger and the white parts of the spring onion for 30 seconds.",
      "Add the vegetables and stir-fry on high heat for 3–4 minutes, keeping them crisp.",
      "Add soy sauce, vinegar and the cornflour slurry; toss until glossy.",
      "Return the tofu, drizzle sesame oil and finish with sesame seeds, spring onion greens and chilli flakes.",
    ],
    n: [265, 19.5, 13, 16.5, 5.5],
  },
  {
    key: "lemon-herb-chicken-quinoa",
    title: "Lemon-Herb Grilled Chicken with Quinoa",
    cuisine: "Mediterranean",
    region: "global",
    meals: ["lunch", "dinner"],
    description: "Juicy grilled chicken breast over lemony quinoa and a fresh chopped salad.",
    prep_minutes: 30,
    servings: 2,
    ingredients: [
      "2 chicken breasts (about 300 g)",
      "½ cup quinoa, rinsed",
      "2 tsp olive oil",
      "2 garlic cloves, grated",
      "Zest and juice of 1 lemon",
      "1 tsp dried oregano or mixed herbs",
      "½ tsp black pepper",
      "1 cup chopped cherry tomatoes and cucumber",
      "A handful of parsley or coriander",
      "Salt to taste",
    ],
    steps: [
      "Marinate the chicken with half the lemon juice, zest, garlic, herbs, pepper, 1 tsp olive oil and salt for 15 minutes.",
      "Simmer the quinoa in 1 cup salted water for 12–15 minutes until fluffy.",
      "Grill or pan-sear the chicken 5–6 minutes per side until cooked through; rest 5 minutes and slice.",
      "Toss the quinoa with tomatoes, cucumber, herbs, remaining lemon juice and olive oil.",
      "Serve the chicken over the quinoa salad.",
    ],
    n: [400, 41, 31, 11, 4],
  },
  {
    key: "shakshuka",
    title: "Shakshuka",
    cuisine: "Middle Eastern",
    region: "global",
    meals: ["breakfast", "dinner"],
    description: "Eggs gently poached in a spiced tomato and pepper sauce — one pan, big flavour.",
    prep_minutes: 25,
    servings: 2,
    ingredients: [
      "4 eggs",
      "1 onion, sliced",
      "1 red bell pepper, sliced",
      "2 garlic cloves, chopped",
      "400 g tomatoes, chopped (or 1 can)",
      "1 tsp cumin powder",
      "1 tsp paprika or Kashmiri chilli powder",
      "2 tsp olive oil",
      "Fresh coriander or parsley",
      "Salt and pepper to taste",
    ],
    steps: [
      "Heat olive oil in a wide pan and cook onion and pepper until soft.",
      "Add garlic, cumin and paprika and cook for 30 seconds.",
      "Add tomatoes, salt and pepper; simmer 8–10 minutes until thick.",
      "Make 4 wells, crack in the eggs, cover and cook 5–7 minutes until the whites set.",
      "Scatter herbs and serve with a slice of whole-grain toast.",
    ],
    n: [260, 15, 17, 15, 4.5],
    tags: ["one-pot"],
  },
  {
    key: "lemony-red-lentil-soup",
    title: "Lemony Red Lentil Soup",
    cuisine: "Mediterranean",
    region: "global",
    meals: ["lunch", "dinner"],
    description: "Turkish-style masoor dal soup with cumin and a squeeze of lemon — silky, filling and vegan.",
    prep_minutes: 30,
    servings: 3,
    ingredients: [
      "1 cup masoor dal (red lentils), rinsed",
      "1 onion, chopped",
      "1 carrot, chopped",
      "2 garlic cloves",
      "1 tomato, chopped",
      "1 tsp cumin powder",
      "½ tsp paprika",
      "1 tbsp olive oil",
      "5 cups water or vegetable stock",
      "Juice of 1 lemon",
      "Salt and pepper to taste",
    ],
    steps: [
      "Heat olive oil and sauté onion, carrot and garlic for 5 minutes.",
      "Add tomato, cumin and paprika and cook 2 minutes.",
      "Add the lentils and water, bring to a boil and simmer 20 minutes until the lentils collapse.",
      "Blend until smooth, season and finish with lemon juice.",
    ],
    n: [290, 16, 46, 5.5, 9],
    tags: ["one-pot", "comfort"],
  },
  {
    key: "mexican-bean-burrito-bowl",
    title: "Mexican Bean Burrito Bowl",
    cuisine: "Mexican",
    region: "global",
    meals: ["lunch"],
    description: "Brown rice, smoky beans, corn, fresh salsa and avocado — a fibre-packed bowl you can build in 20 minutes.",
    prep_minutes: 20,
    servings: 2,
    ingredients: [
      "1 cup cooked brown rice",
      "1½ cups cooked rajma or black beans",
      "½ cup sweet corn",
      "1 tomato and 1 small onion, finely chopped for salsa",
      "½ avocado, sliced",
      "1 tsp cumin powder",
      "½ tsp smoked paprika",
      "Juice of 1 lime",
      "1 tsp oil",
      "Coriander and lettuce",
      "Salt to taste",
    ],
    steps: [
      "Warm the beans in oil with cumin, paprika, salt and a splash of water; mash a few for creaminess.",
      "Mix tomato, onion, coriander, half the lime juice and salt for a quick salsa.",
      "Toss the rice with the remaining lime juice.",
      "Build bowls with lettuce, rice, beans, corn, salsa and avocado.",
    ],
    n: [410, 16, 66, 10, 15.5],
  },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

function build(s: Seed): LibraryRecipe {
  const [calories, protein_g, carbs_g, fat_g, fiber_g] = s.n;
  const nutrition: Nutrients = { calories: Math.round(calories), protein_g: round1(protein_g), carbs_g: round1(carbs_g), fat_g: round1(fat_g), fiber_g: round1(fiber_g) };
  const { diet, jain } = detectDiet(s.ingredients);
  const allergens = detectAllergens(s.ingredients);
  const tags = [
    ...new Set([
      s.region === "global" ? "global" : "indian",
      s.region,
      slug(s.cuisine),
      ...s.meals,
      ...deriveTags({ ingredients: s.ingredients, nutrition, prep_minutes: s.prep_minutes }),
      ...(s.tags || []),
    ]),
  ];
  return {
    key: s.key,
    title: s.title,
    cuisine: s.cuisine,
    description: s.description,
    prep_minutes: s.prep_minutes,
    servings: s.servings,
    ingredients: s.ingredients,
    steps: s.steps,
    nutrition,
    tags,
    diet,
    jain,
    allergens,
    meals: s.meals,
    region: s.region,
  };
}

export const RECIPE_LIBRARY: LibraryRecipe[] = SEEDS.map(build);

/* ───────────────────────────── Cuisine matching ───────────────────────────── */

const GROUP_WORDS: Array<[RegExp, RegionGroup | "indian"]> = [
  [/\bnorth(ern)?\s*(indian?)?\b/, "north-indian"],
  [/\bsouth(ern)?\s*(indian?)?\b/, "south-indian"],
  [/\bwest(ern)?\s*indian?\b/, "west-indian"],
  [/\b(east(ern)?|north\s*east(ern)?)\s*(and\s*north\s*east(ern)?\s*)?indian?\b/, "east-indian"],
  [/\b(global|international|world|continental|western)\b/, "global"],
  [/\b(indian|desi)\b/, "indian"],
];

/** Free-text cuisine words → library cuisine names. */
const CUISINE_ALIASES: Array<[RegExp, string]> = [
  [/\b(punjabi|punjab|amritsari|dhaba)\b/, "Punjabi"],
  [/\b(rajasthani|rajasthan|marwari)\b/, "Rajasthani"],
  [/\b(gujarati|gujarat|gujju|kathiyawadi)\b/, "Gujarati"],
  [/\b(maharashtrian|maharashtra|marathi|mumbai|bombay)\b/, "Maharashtrian"],
  [/\b(goan|goa|konkani)\b/, "Goan"],
  [/\b(bengali|bengal|bong|kolkata)\b/, "Bengali"],
  [/\b(assamese|assam|axomiya)\b/, "Assamese"],
  [/\b(bihari|bihar|mithila)\b/, "Bihari"],
  [/\b(kerala|keralan|malayali|malabar)\b/, "Kerala"],
  [/\b(tamil|chettinad|madras|chennai)\b/, "Tamil"],
  [/\b(karnataka|kannada|udupi|mangalorean|bangalore)\b/, "Karnataka"],
  [/\b(andhra|telugu)\b/, "Andhra"],
  [/\b(hyderabadi|hyderabad|telangana|nizami)\b/, "Hyderabadi"],
  [/\b(mediterranean|greek|turkish|italian)\b/, "Mediterranean"],
  [/\b(mexican|tex mex|burrito)\b/, "Mexican"],
  [/\b(east asian|asian|chinese|thai|japanese|korean|indo chinese)\b/, "East Asian"],
  [/\b(middle eastern|arabic|lebanese|israeli|persian)\b/, "Middle Eastern"],
  [/\b(continental|european|english)\b/, "Continental"],
];

type CuisineQuery = { groups: Array<RegionGroup | "indian">; names: string[] };

function parseCuisine(text: string): CuisineQuery {
  const t = ` ${norm(text).replace(/[-_/&,]/g, " ")} `;
  const names = CUISINE_ALIASES.filter(([re]) => re.test(t)).map(([, n]) => n);
  const groups: Array<RegionGroup | "indian"> = [];
  // Specific states win over the generic "Indian" word, e.g. "South Indian" shouldn't also mean "any Indian".
  for (const [re, g] of GROUP_WORDS) {
    if (!re.test(t)) continue;
    if (g === "indian" && groups.length) continue;
    if (g === "global" && names.length) continue;
    groups.push(g);
  }
  return { groups, names };
}

function matchesCuisine(r: LibraryRecipe, q: CuisineQuery) {
  if (q.names.includes(r.cuisine)) return true;
  return q.groups.some((g) => (g === "indian" ? r.region !== "global" : r.region === g));
}

/** Profile region (e.g. "Kerala", "West Bengal") → the cuisine(s) we lean towards. */
function regionCuisine(region?: string): CuisineQuery | null {
  if (!region) return null;
  const r = norm(region);
  const map: Array<[RegExp, CuisineQuery]> = [
    [/punjab|chandigarh/, { names: ["Punjabi"], groups: ["north-indian"] }],
    [/haryana|delhi|uttar pradesh|uttarakhand|himachal|jammu|kashmir|ladakh|madhya pradesh|chhattisgarh/, { names: [], groups: ["north-indian"] }],
    [/rajasthan/, { names: ["Rajasthani"], groups: ["north-indian"] }],
    [/gujarat|daman|dadra/, { names: ["Gujarati"], groups: ["west-indian"] }],
    [/maharashtra/, { names: ["Maharashtrian"], groups: ["west-indian"] }],
    [/goa/, { names: ["Goan"], groups: ["west-indian"] }],
    [/kerala|lakshadweep/, { names: ["Kerala"], groups: ["south-indian"] }],
    [/tamil|puducherry/, { names: ["Tamil"], groups: ["south-indian"] }],
    [/karnataka/, { names: ["Karnataka"], groups: ["south-indian"] }],
    [/andhra/, { names: ["Andhra"], groups: ["south-indian"] }],
    [/telangana/, { names: ["Hyderabadi", "Andhra"], groups: ["south-indian"] }],
    [/bengal|odisha|tripura|andaman/, { names: ["Bengali"], groups: ["east-indian"] }],
    [/assam|arunachal|manipur|meghalaya|mizoram|nagaland|sikkim/, { names: ["Assamese"], groups: ["east-indian"] }],
    [/bihar|jharkhand/, { names: ["Bihari"], groups: ["east-indian"] }],
    [/outside india/, { names: [], groups: ["global"] }],
  ];
  return map.find(([re]) => re.test(r))?.[1] ?? null;
}

/* ───────────────────────────── Prompt parsing ───────────────────────────── */

type Want = "high-protein" | "low-carb" | "quick" | "low-calorie" | "high-fibre" | "dessert" | "one-pot" | "comfort" | "tiffin";

export interface PromptConstraints {
  /** Diets the prompt explicitly asks for (e.g. "Jain-friendly lunch" → ["jain"]). */
  diets: Diet[];
  /** Extra things to avoid ("gluten-free" → gluten, "no onion" → onion). */
  avoid: string[];
  max_calories?: number;
}

const WANTS: Array<[RegExp, Want]> = [
  [/\b(high\s*protein|protein\s*(rich|packed|heavy)|more protein|protein|gym|muscle|post\s*workout|workout)\b/, "high-protein"],
  [/\b(low\s*carbs?|keto|no rice|less carbs?|carb\s*free)\b/, "low-carb"],
  [/\b(quick|fast|easy|instant|jaldi|busy|in\s*\d{1,2}\s*min(ute)?s?|\d{1,2}\s*min(ute)?s?)\b/, "quick"],
  [/\b(light|low\s*cal(orie)?s?|weight\s*loss|lose\s*weight|lean)\b/, "low-calorie"],
  [/\b(fib(re|er)|gut|digestion|digestive)\b/, "high-fibre"],
  [/\b(dessert|sweet|meetha|mithai|kheer)\b/, "dessert"],
  [/\b(one\s*pot|one\s*pan)\b/, "one-pot"],
  [/\b(comfort|cozy|cosy|monsoon|rainy|winter|soothing)\b/, "comfort"],
  [/\b(tiffin|lunch\s*box|lunchbox|travel|office)\b/, "tiffin"],
];

const MEAL_WORDS: Array<[RegExp, MealType]> = [
  [/\b(breakfast|nashta|nasta|morning)\b/, "breakfast"],
  [/\b(lunch|dopahar|afternoon)\b/, "lunch"],
  [/\b(dinner|supper|raat|night|tonight)\b/, "dinner"],
  [/\b(snack|snacks|evening|chai\s*time|munch(ies)?)\b/, "snack"],
];

/** Hinglish/Hindi food words → the English words used in the library. */
const SYNONYMS: Record<string, string> = {
  anda: "egg", ande: "egg", eggs: "egg", murgh: "chicken", murg: "chicken", murgi: "chicken", machli: "fish", machhi: "fish",
  macher: "fish", maach: "fish", meen: "fish", daal: "dal", dals: "dal", chawal: "rice", sabzi: "vegetable", sabji: "vegetable",
  veggie: "vegetable", veggies: "vegetable", vegetables: "vegetable", aloo: "potato", palak: "spinach", chole: "chickpea",
  chana: "chickpea", chickpeas: "chickpea", rajmah: "rajma", dahi: "curd", yoghurt: "curd", yogurt: "curd", baingan: "brinjal",
  eggplant: "brinjal", millets: "millet", oat: "oats", prawns: "prawn", shrimp: "prawn", lentils: "lentil", beans: "bean",
  salads: "salad", soups: "soup", pancakes: "chilla", pancake: "chilla", cheela: "chilla", idly: "idli", dosai: "dosa",
};

const STOPWORDS = new Set(
  (
    "a an the for with and or of in on to my me i we our you your some something any anything want wants would like make made " +
    "give suggest suggestion please recipe recipes dish dishes food foods meal meals healthy tasty nice good yummy idea ideas " +
    "today tomorrow kuch banao bana hai ka ki ke mujhe chahiye friendly style based rich under below less than within max upto " +
    "up kcal cal cals calorie calories per serving servings around about that this is it can not too very also just only " +
    "cook cooking home homemade simple option options type kind"
  )
    .split(/\s+/)
    .filter(Boolean)
);

function parsePrompt(prompt = "") {
  let t = ` ${norm(prompt).replace(/[-_/,.!?;:()'"]/g, " ")} `;
  const diets: Diet[] = [];
  const avoid: string[] = [];
  let preferNonVeg = false;
  let maxCalories: number | undefined;

  // calories: "under 500 kcal", "below 400", "400 cal"
  const cal =
    t.match(/\b(?:under|below|less than|within|max(?:imum)?|upto|up to|<)\s*(\d{2,4})\s*(?:k?cals?|kcal|calories)?\b/) ||
    t.match(/\b(\d{3,4})\s*(?:k?cals?|kcal|calories)\b/);
  if (cal) {
    const v = Number(cal[1]);
    if (v >= 150 && v <= 1500) maxCalories = v;
    t = t.replace(cal[0], " ");
  }

  // "avoid" phrases before diet words so "no onion" isn't read as anything else
  const avoidPhrases: Array<[RegExp, string[]]> = [
    [/\b(gluten\s*free|no\s*gluten|no\s*wheat|without\s*wheat|wheat\s*free)\b/, ["gluten"]],
    [/\b(dairy\s*free|no\s*dairy|lactose\s*free|without\s*dairy|no\s*milk)\b/, ["dairy"]],
    [/\b(nut\s*free|no\s*nuts?|without\s*nuts?)\b/, ["tree nuts", "peanuts"]],
    [/\b(egg\s*free|no\s*eggs?|eggless|without\s*eggs?)\b/, ["eggs"]],
    [/\b(soy\s*free|no\s*soy(a)?)\b/, ["soy"]],
    [/\b(no|without)\s*onions?\b/, ["onion"]],
    [/\b(no|without)\s*garlic\b/, ["garlic"]],
    [/\b(no|without)\s*(onion|onions)\s*(or|and|\/)?\s*garlic\b/, ["onion", "garlic"]],
    [/\b(no|without)\s*(paneer)\b/, ["paneer"]],
    [/\b(no|without)\s*(mushrooms?)\b/, ["mushroom"]],
  ];
  for (const [re, what] of avoidPhrases) {
    if (re.test(t)) {
      avoid.push(...what);
      t = t.replace(re, " ");
    }
  }

  if (/\bnon\s*veg(etarian)?\b/.test(t)) {
    preferNonVeg = true;
    t = t.replace(/\bnon\s*veg(etarian)?\b/g, " ");
  }
  if (/\bvegan\b/.test(t)) diets.push("vegan");
  if (/\bjain\b/.test(t)) diets.push("jain");
  if (/\beggetarian\b/.test(t)) diets.push("eggetarian");
  if (/\b(veg|vegetarian|shakahari|pure\s*veg)\b/.test(t) && !diets.includes("vegan")) diets.push("vegetarian");
  t = t.replace(/\b(vegan|jain|eggetarian|veg|vegetarian|shakahari|pure)\b/g, " ");

  const wants = new Set<Want>();
  for (const [re, w] of WANTS) {
    if (re.test(t)) {
      wants.add(w);
      t = t.replace(new RegExp(re.source, "g"), " ");
    }
  }
  const meals = new Set<MealType>();
  for (const [re, m] of MEAL_WORDS) {
    if (re.test(t)) {
      meals.add(m);
      t = t.replace(new RegExp(re.source, "g"), " ");
    }
  }
  const cuisine = parseCuisine(t);
  for (const [re] of CUISINE_ALIASES) t = t.replace(new RegExp(re.source, "g"), " ");
  t = t.replace(/\b(north|south|east|west|northeast|indian|desi|global|international|continental)\b/g, " ");

  const tokens = t
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z]/g, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map((w) => SYNONYMS[w] || w);

  return { diets, avoid, maxCalories, preferNonVeg, wants, meals, cuisine, tokens: [...new Set(tokens)] };
}

/** Constraints a free-text request adds on top of the profile (used by both the library and the AI path). */
export function promptConstraints(prompt?: string): PromptConstraints {
  const p = parsePrompt(prompt || "");
  return { diets: p.diets, avoid: p.avoid, ...(p.maxCalories ? { max_calories: p.maxCalories } : {}) };
}

/* ───────────────────────────── Picker ───────────────────────────── */

export interface PickOptions {
  prompt?: string;
  max_calories?: number;
  cuisine?: string;
  diet?: Diet;
  allergies?: string[];
  /** Recently generated keys, newest first — rotated to the back of the queue. */
  excludeKeys?: string[];
  /** Profile region, for a gentle home-cuisine bias when nothing else is asked. */
  region?: string;
  /** Time-of-day meal hint when the prompt doesn't name a meal. */
  mealHint?: MealType;
}

export interface PickResult {
  recipe: LibraryRecipe;
  /** Filters that had to be loosened to find a match. Diet and allergies are never loosened. */
  relaxed: Array<"cuisine" | "calories">;
  max_calories?: number;
}

type Index = { title: Set<string>; tags: Set<string>; cuisine: Set<string>; ingredients: Set<string> };
const words = (s: string) =>
  new Set(
    norm(s)
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3)
      .flatMap((w) => [w, stem(w)])
  );
const INDEX = new Map<string, Index>(
  RECIPE_LIBRARY.map((r) => [
    r.key,
    {
      title: words(r.title),
      tags: words(r.tags.join(" ")),
      cuisine: words(`${r.cuisine} ${r.region}`),
      ingredients: words(r.ingredients.join(" ")),
    },
  ])
);

/**
 * Deterministic recipe pick: hard-filters by diet (all of profile/explicit + prompt diets)
 * and allergies, then cuisine and calories (loosened only if nothing fits), then keyword-scores
 * the prompt and rotates away from recently generated recipes.
 */
export function pickRecipe(opts: PickOptions): PickResult | null {
  const p = parsePrompt(opts.prompt || "");
  const diets = [...new Set([...(opts.diet ? [opts.diet] : []), ...p.diets])];
  const allergies = [...(opts.allergies || []), ...p.avoid];
  const cap = opts.max_calories ?? p.maxCalories;
  const recent = opts.excludeKeys || [];

  // 1) Safety filters — never relaxed.
  const { canon, custom } = normalizeAllergies(allergies);
  const safe = RECIPE_LIBRARY.filter((r) => {
    if (!diets.every((d) => dietAllows(d, r))) return false;
    if (canon.some((a) => r.allergens.includes(a))) return false;
    if (custom.length) {
      const text = ingredientText(r.ingredients, r.title);
      if (custom.some((c) => wordRe(c).test(text))) return false;
    }
    return true;
  });
  if (!safe.length) return null;

  const relaxed: PickResult["relaxed"] = [];

  // 2) Explicit cuisine filter.
  let pool = safe;
  const cq = opts.cuisine ? parseCuisine(opts.cuisine) : null;
  if (cq && (cq.groups.length || cq.names.length)) {
    const byCuisine = pool.filter((r) => matchesCuisine(r, cq));
    if (byCuisine.length) pool = byCuisine;
    else relaxed.push("cuisine");
  } else if (opts.cuisine) {
    // A cuisine we don't have in the collection (e.g. "Japanese") — match on the cuisine text itself.
    const q = norm(opts.cuisine);
    const byText = pool.filter((r) => norm(r.cuisine).includes(q) || q.includes(norm(r.cuisine)));
    if (byText.length) pool = byText;
    else relaxed.push("cuisine");
  }

  // 3) Calorie cap (per serving). If nothing fits, keep the lightest options.
  if (cap) {
    const within = pool.filter((r) => r.nutrition.calories <= cap);
    if (within.length) pool = within;
    else {
      relaxed.push("calories");
      const lightest = Math.min(...pool.map((r) => r.nutrition.calories));
      pool = pool.filter((r) => r.nutrition.calories <= lightest * 1.25);
    }
  }

  // 4) Score.
  const promptCuisine = p.cuisine.groups.length || p.cuisine.names.length ? p.cuisine : null;
  const home = !promptCuisine && !opts.cuisine ? regionCuisine(opts.region) : null;
  const mealHint = !p.meals.size ? opts.mealHint : undefined;

  const scored = pool.map((r, i) => {
    const ix = INDEX.get(r.key)!;
    let score = 0;
    for (const tok of p.tokens) {
      const s = stem(tok);
      const has = (set: Set<string>) => set.has(tok) || set.has(s);
      if (has(ix.title)) score += 4;
      else if (has(ix.tags) || has(ix.cuisine)) score += 3;
      else if (has(ix.ingredients)) score += 1.5;
    }
    for (const m of p.meals) if (r.meals.includes(m)) score += 3;
    if (mealHint && r.meals.includes(mealHint)) score += 1;
    for (const w of p.wants) {
      if (r.tags.includes(w)) score += 4;
      if (w === "high-protein") score += r.nutrition.protein_g / 8;
      if (w === "low-calorie") score += Math.max(0, (400 - r.nutrition.calories) / 100);
    }
    if (p.preferNonVeg && r.diet === "non_vegetarian") score += 3;
    if (promptCuisine && matchesCuisine(r, promptCuisine)) score += 6;
    if (home && matchesCuisine(r, home)) score += home.names.includes(r.cuisine) ? 2 : 1;
    if (cap) score += Math.min(1, r.nutrition.calories / cap) * 1.5; // use the budget well
    const seen = recent.indexOf(r.key);
    if (seen >= 0) score -= 50 + (recent.length - seen); // newest = biggest penalty
    return { r, score, i };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);

  return { recipe: scored[0].r, relaxed, ...(cap ? { max_calories: cap } : {}) };
}

/* ───────────────────────────── Stored recipes ───────────────────────────── */

/** A recipe document in the `recipes` collection: the shared `Recipe` plus where it came from. */
export interface StoredRecipe extends Recipe {
  source: "ai" | "library";
  /** Library key for curated recipes — used to rotate away from recent picks. */
  library_key?: string;
  /** The request that produced it (shown as context in the UI). */
  prompt?: string;
}
