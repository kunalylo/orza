import type { Nutrients } from "@/lib/types";
import type { FoodEntry } from "./types";

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Nutrients for `quantity` servings (quantity may be fractional).
 * Restaurant style scales calories by the food's restaurant_multiplier and books the extra energy
 * as fat (oil, butter, cream at 9 kcal/g); protein, carbs and fibre stay home-style.
 */
export function nutrientsFor(food: FoodEntry, quantity: number, restaurant = false): Nutrients {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const p = food.per_serving;
  let calories = (Number(p.calories) || 0) * q;
  let fat = (Number(p.fat_g) || 0) * q;
  const m = restaurant ? Number(food.restaurant_multiplier) || 1 : 1;
  if (m > 1) {
    const extra = calories * (m - 1);
    calories += extra;
    fat += extra / 9;
  }
  return {
    calories: Math.round(calories),
    protein_g: r1((Number(p.protein_g) || 0) * q),
    carbs_g: r1((Number(p.carbs_g) || 0) * q),
    fat_g: r1(fat),
    fiber_g: r1((Number(p.fiber_g) || 0) * q),
  };
}
