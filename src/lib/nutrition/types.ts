import type { Nutrients } from "@/lib/types";

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

/**
 * Parser-only portion hints, kept out of FoodEntry so the public shape stays stable.
 * All values are in default servings of the food.
 */
export interface FoodHints {
  pcs?: number; // pieces in one serving, e.g. 6 momos in "1 plate"
  plate?: number; // servings in "1 plate" of a counted food (default 2, e.g. a plate of samosa)
  eggs?: number; // eggs in one serving, so "3 egg omelette" = 1.5 servings
  words?: Partial<Record<"half" | "full" | "single" | "double", number>>; // "half tandoori" = 2 pieces, "single omelette" = 0.5
  same?: string[]; // other portion words that also mean one serving, e.g. protein shake: "scoop" = "glass"
}
