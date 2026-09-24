/**
 * Size limits for one logged meal item — the single source of truth for every path that creates
 * items (free-text parser, food list, AI text/photo) and every validator that accepts them back
 * (meal edits, scan confirmation, custom items). Keeping them in one place means anything ÖRZA
 * logs can always be edited and saved again.
 *
 * Client-safe: no food data is imported here.
 */
import type { Nutrients } from "@/lib/types";
import type { FoodEntry } from "./types";

export const ITEM_LIMITS = {
  quantity: 100,
  grams: 5000,
  calories: 5000,
  protein_g: 500,
  carbs_g: 1000,
  fat_g: 500,
  fiber_g: 200,
} as const;

/** Most servings of one food logged as a single item (the food-list picker's cap too). */
export const MAX_SERVINGS = 20;

type ServingSource = Pick<FoodEntry, "serving" | "per_serving" | "restaurant_multiplier">;

/**
 * Largest number of servings of `food` that fits one item: never more than {@link MAX_SERVINGS},
 * and never so many that its weight, calories or any macro passes {@link ITEM_LIMITS}.
 * Rounded down to 0.01 so the rounded nutrients stay inside the limits too.
 */
export function maxServingsFor(food: ServingSource, restaurant = false): number {
  const p = food.per_serving;
  const m = restaurant ? Math.max(1, Number(food.restaurant_multiplier) || 1) : 1;
  const kcal = (Number(p?.calories) || 0) * m;
  // Same maths as nutrientsFor(): restaurant extra energy is booked as fat.
  const fat = (Number(p?.fat_g) || 0) + ((Number(p?.calories) || 0) * (m - 1)) / 9;
  let max: number = MAX_SERVINGS;
  const cap = (limit: number, perServing: number) => {
    if (perServing > 0) max = Math.min(max, limit / perServing);
  };
  cap(ITEM_LIMITS.grams, Number(food.serving?.grams) || 0);
  cap(ITEM_LIMITS.calories, kcal);
  cap(ITEM_LIMITS.protein_g, Number(p?.protein_g) || 0);
  cap(ITEM_LIMITS.carbs_g, Number(p?.carbs_g) || 0);
  cap(ITEM_LIMITS.fat_g, fat);
  cap(ITEM_LIMITS.fiber_g, Number(p?.fiber_g) || 0);
  return Math.max(0.01, Math.floor(max * 100 + 1e-9) / 100);
}

type ItemNumbers = Nutrients & { quantity: number; grams?: number };

/** Clamp each number of an item into {@link ITEM_LIMITS} (used for AI output, which is estimated field by field). */
export function clampToItemLimits<T extends ItemNumbers>(item: T): T {
  const c = (v: number, max: number) => (Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
  return {
    ...item,
    quantity: Math.min(ITEM_LIMITS.quantity, item.quantity),
    grams: item.grams != null ? c(item.grams, ITEM_LIMITS.grams) : item.grams,
    calories: c(item.calories, ITEM_LIMITS.calories),
    protein_g: c(item.protein_g, ITEM_LIMITS.protein_g),
    carbs_g: c(item.carbs_g, ITEM_LIMITS.carbs_g),
    fat_g: c(item.fat_g, ITEM_LIMITS.fat_g),
    fiber_g: c(item.fiber_g, ITEM_LIMITS.fiber_g),
  };
}
