import type { Goal, Meal, MealType, Nutrients, Targets, TrackingDay } from "@/lib/types";

export type WeekDay = { date: string; calories: number; meals: number };

/** Response of GET /api/dashboard/today. */
export type TodayData = {
  date: string;
  /** The user's current day in their timezone (upper bound for date navigation). */
  today: string;
  targets: Targets;
  totals: Nutrients;
  meals: Meal[];
  tracking: TrackingDay;
  remaining: { calories: number; protein_g: number };
  streak: number;
  insight: string;
  goal: Goal | null;
  week: WeekDay[];
  last_weight: { weight_kg: number; date: string } | null;
};

export type TrackingResponse = { tracking: TrackingDay };

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snacks",
  dinner: "Dinner",
};
