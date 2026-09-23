/**
 * ÖRZA built-in Indian + global food database and natural-language meal parser.
 * Used as the no-AI fallback for text/voice/chat meal logging, and to sanity-check AI output.
 *
 * INTERFACE CONTRACT — other modules import exactly these exports:
 *   FOODS, findFood, searchFoods, parseMealText, nutrientsFor
 * (Implementation is filled in by the meals/nutrition work-stream.)
 */
import type { MealItem, MealType, Nutrients } from "@/lib/types";

export type FoodDiet = "veg" | "vegan" | "egg" | "nonveg";

export interface FoodEntry {
  key: string; // stable slug, e.g. "dal_tadka"
  name: string; // display name, e.g. "Dal Tadka"
  aliases: string[]; // lowercase synonyms incl. Hindi/Hinglish, e.g. ["dal", "daal", "tadka dal"]
  category: string; // "bread" | "rice" | "dal" | "sabzi" | "snack" | "sweet" | "drink" | "fruit" | "dairy" | "egg" | "meat" | "global" ...
  diet: FoodDiet;
  region?: string; // e.g. "Punjab"
  serving: { unit: string; grams: number; label: string }; // default serving, e.g. { unit: "katori", grams: 150, label: "1 katori (150 g)" }
  per_serving: Nutrients; // home-style values for one default serving
  restaurant_multiplier?: number; // calorie/fat multiplier for restaurant style (e.g. 1.6 for dal)
}

export const FOODS: FoodEntry[] = [];

/** Best single match for a free-text food name (aliases, fuzzy), or null. */
export function findFood(query: string): FoodEntry | null {
  void query;
  return null;
}

/** Ranked search for autocomplete. */
export function searchFoods(query: string, limit = 8): FoodEntry[] {
  void query;
  void limit;
  return [];
}

/** Nutrients for `quantity` servings (quantity may be fractional). */
export function nutrientsFor(food: FoodEntry, quantity: number, restaurant = false): Nutrients {
  void food;
  void quantity;
  void restaurant;
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };
}

/**
 * Parse "aaj maine breakfast mein do paratha aur dahi khaya", "2 roti, 1 katori dal and half plate rice",
 * "had a masala dosa from a restaurant" into items. Understands English/Hindi/Hinglish numbers
 * (ek/do/teen/aadha/half/one/two/2/1.5), Indian portions (katori/bowl/plate/half plate/glass/piece/cup/tbsp),
 * meal words (breakfast/nashta, lunch, dinner/raat, snack) and restaurant cues (restaurant/hotel/dhaba/outside/order).
 */
export function parseMealText(text: string): {
  items: MealItem[];
  unmatched: string[];
  mealType?: MealType;
  restaurant: boolean;
} {
  void text;
  return { items: [], unmatched: [], restaurant: false };
}
