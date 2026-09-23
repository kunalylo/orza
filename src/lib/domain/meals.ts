import { col, newId, nowISO } from "@/lib/db";
import type { Meal, MealItem, MealSource, MealType, Nutrients } from "@/lib/types";
import { hourInTz } from "@/lib/dates";
import { round } from "@/lib/utils";

export const ZERO: Nutrients = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export function sumNutrients(list: Partial<Nutrients>[]): Nutrients {
  const t = list.reduce<Nutrients>(
    (acc, n) => ({
      calories: acc.calories + (Number(n.calories) || 0),
      protein_g: acc.protein_g + (Number(n.protein_g) || 0),
      carbs_g: acc.carbs_g + (Number(n.carbs_g) || 0),
      fat_g: acc.fat_g + (Number(n.fat_g) || 0),
      fiber_g: acc.fiber_g + (Number(n.fiber_g) || 0),
    }),
    { ...ZERO }
  );
  return {
    calories: Math.round(t.calories),
    protein_g: round(t.protein_g, 1),
    carbs_g: round(t.carbs_g, 1),
    fat_g: round(t.fat_g, 1),
    fiber_g: round(t.fiber_g, 1),
  };
}

/** Normalise an item (coerce numbers, clamp negatives, round). */
export function cleanItem(i: Partial<MealItem>): MealItem {
  const n = (v: any, d = 1) => Math.max(0, round(Number(v) || 0, d));
  return {
    name: String(i.name || "Food").slice(0, 80),
    quantity: n(i.quantity ?? 1, 2) || 1,
    unit: String(i.unit || "serving").slice(0, 24),
    grams: i.grams != null ? n(i.grams, 0) : undefined,
    calories: n(i.calories, 0),
    protein_g: n(i.protein_g),
    carbs_g: n(i.carbs_g),
    fat_g: n(i.fat_g),
    fiber_g: n(i.fiber_g),
    confidence: i.confidence != null ? Math.min(1, n(i.confidence, 2)) : undefined,
  };
}

export function guessMealType(tz?: string): MealType {
  const h = hourInTz(tz);
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 19 || h < 2) return "dinner";
  return "snack";
}

export async function createMeal(input: {
  userId: string;
  date: string;
  mealType: MealType;
  source: MealSource;
  description: string;
  items: Partial<MealItem>[];
  notes?: string;
}): Promise<Meal> {
  const items = input.items.map(cleanItem);
  const meal: Meal = {
    id: newId(),
    user_id: input.userId,
    date: input.date,
    meal_type: input.mealType,
    source: input.source,
    description: input.description.slice(0, 500),
    items,
    totals: sumNutrients(items),
    notes: input.notes,
    created_at: nowISO(),
  };
  await col<Meal>("meals").insertOne(meal);
  return meal;
}

export async function listMeals(userId: string, date: string): Promise<Meal[]> {
  return col<Meal>("meals").find({ user_id: userId, date }, { sort: { created_at: 1 } });
}

export async function listMealsInRange(userId: string, from: string, to: string): Promise<Meal[]> {
  return col<Meal>("meals").find({ user_id: userId, date: { $gte: from, $lte: to } }, { sort: { date: 1, created_at: 1 } });
}

export async function dayTotals(userId: string, date: string): Promise<Nutrients> {
  return sumNutrients((await listMeals(userId, date)).map((m) => m.totals));
}
