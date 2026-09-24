/**
 * Diet-aware resolution of ambiguous dish words for the free-text parser.
 *
 * Some everyday words name a dish that exists in several versions — "biryani", "kathi roll",
 * "kebab", "club sandwich", "tikka". The food list files the bare word under the most common
 * (often non-vegetarian) version, which is right for most people but wrong for someone who
 * doesn't eat meat. So:
 *  - a word that itself names the protein ("chicken biryani", "murgh tikka", "tangdi kabab") is kept as said;
 *  - a vegetable/paneer word ("aloo biryani", "paneer kathi roll") always picks the vegetarian version;
 *  - otherwise the user's diet decides: vegetarian, vegan, Jain and eggetarian profiles get the
 *    vegetarian version, everyone else keeps the default.
 */
import type { Diet } from "@/lib/types";
import { avoidsMeat, dietAllowsFood } from "./diet-rules";
import { FOODS } from "./foods";
import type { FoodDiet, FoodEntry } from "./types";

/** Non-vegetarian entries with a vegetarian twin in the food list. */
const VEG_TWIN: Record<string, string> = {
  chicken_biryani: "veg_biryani",
  mutton_biryani: "veg_biryani",
  chicken_fried_rice: "veg_fried_rice",
  chicken_tikka: "paneer_tikka",
  tandoori_chicken: "paneer_tikka",
  chicken_tikka_masala: "paneer_butter_masala",
  seekh_kebab: "hara_bhara_kabab",
  chicken_roll: "veg_roll",
  chicken_sandwich: "veg_sandwich",
  nonveg_thali: "veg_thali",
};

/** Words that name meat, fish or egg — an alias containing one says exactly what was eaten. */
const PROTEIN_WORDS = new Set([
  "chicken", "murgh", "murg", "murgi", "murgir", "kozhi", "mutton", "gosht", "lamb", "goat", "meat", "keema", "kheema", "qeema",
  "beef", "pork", "fish", "machli", "machhli", "meen", "prawn", "prawns", "jhinga", "shrimp", "egg", "eggs", "anda", "ande",
  "non", "nonveg", "leg", "tangdi", "tangri", "boti", "pepperoni", "ham", "bacon", "sausage", "salami", "tuna", "salmon",
]);

/** Words that mark the vegetarian version of a dish ("aloo biryani", "paneer roll", "veg kebab"). */
const VEG_WORDS = new Set([
  "veg", "vegetable", "vegetables", "sabzi", "paneer", "aloo", "gobi", "gobhi", "palak", "methi", "mushroom", "soya", "tofu",
  "corn", "sattu", "matar", "chana", "rajma", "dal", "kathal", "jackfruit", "cheese", "hara", "bhara",
]);

let byKey: Map<string, FoodEntry> | null = null;
const food = (key: string) => (byKey ??= new Map(FOODS.map((f) => [f.key, f]))).get(key) ?? null;

/**
 * The food a matched phrase should be logged as, given what was said (`words`, canonical tokens of
 * the matched phrase) and the user's diet. Returns the original food when there's nothing to resolve.
 */
export function resolveForDiet(matched: FoodEntry, words: string[], diet?: Diet | null): FoodEntry {
  const twinKey = VEG_TWIN[matched.key];
  if (!twinKey) return matched;
  if (words.some((w) => PROTEIN_WORDS.has(w))) return matched;
  const saysVeg = words.some((w) => VEG_WORDS.has(w));
  if (!saysVeg && !avoidsMeat(diet)) return matched;
  return food(twinKey) ?? matched;
}

/**
 * Food-list search results with the ones that fit the user's diet first (order otherwise kept).
 * A query that names meat, fish or egg ("chicken tikka") is taken literally and left as ranked.
 */
export function preferDietFoods<T extends { diet: FoodDiet }>(foods: T[], query: string, diet?: Diet | null): T[] {
  if (!diet || diet === "non_vegetarian") return foods;
  const words = query.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.some((w) => PROTEIN_WORDS.has(w))) return foods;
  const fits = foods.filter((f) => dietAllowsFood(diet, f.diet));
  return fits.length === foods.length ? foods : [...fits, ...foods.filter((f) => !dietAllowsFood(diet, f.diet))];
}
