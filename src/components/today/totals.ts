import type { Meal, Nutrients } from "@/lib/types";

/** Client-safe sum of meal totals (the server-side helper in lib/domain pulls in the DB layer). */
export function sumMealTotals(meals: Pick<Meal, "totals">[]): Nutrients {
  const t = meals.reduce(
    (a, m) => ({
      calories: a.calories + (Number(m.totals?.calories) || 0),
      protein_g: a.protein_g + (Number(m.totals?.protein_g) || 0),
      carbs_g: a.carbs_g + (Number(m.totals?.carbs_g) || 0),
      fat_g: a.fat_g + (Number(m.totals?.fat_g) || 0),
      fiber_g: a.fiber_g + (Number(m.totals?.fiber_g) || 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
  );
  return {
    calories: Math.round(t.calories),
    protein_g: Math.round(t.protein_g * 10) / 10,
    carbs_g: Math.round(t.carbs_g * 10) / 10,
    fat_g: Math.round(t.fat_g * 10) / 10,
    fiber_g: Math.round(t.fiber_g * 10) / 10,
  };
}
