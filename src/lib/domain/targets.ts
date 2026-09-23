import type { ActivityLevel, GoalType, Profile, Targets } from "@/lib/types";
import { round } from "@/lib/utils";

const ACTIVITY: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const DEFAULT_TARGETS: Targets = {
  calories: 2000,
  protein_g: 75,
  carbs_g: 250,
  fat_g: 65,
  fiber_g: 30,
  water_glasses: 8,
  steps: 8000,
};

/** Mifflin–St Jeor BMR. Returns null when the profile is incomplete. */
export function bmr(p: Profile): number | null {
  if (!p.weight_kg || !p.height_cm || !p.age) return null;
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  const sexAdj = p.sex === "male" ? 5 : p.sex === "female" ? -161 : -78;
  return Math.round(base + sexAdj);
}

export function tdee(p: Profile): number | null {
  const b = bmr(p);
  if (b == null) return null;
  return Math.round(b * ACTIVITY[p.activity_level || "light"]);
}

/**
 * Daily targets from a profile.
 * weeklyRateKg: planned weight change per week (e.g. -0.5). 1 kg ≈ 7700 kcal.
 * Calorie floor keeps plans gentle (never below 1200 / BMR).
 */
export function computeTargets(p: Profile, opts: { goal?: GoalType; weeklyRateKg?: number } = {}): Targets & { bmr: number | null; tdee: number | null } {
  const goal = opts.goal || p.goal || "maintain";
  const b = bmr(p);
  const t = tdee(p);
  if (t == null) return { ...DEFAULT_TARGETS, bmr: b, tdee: t };

  const rate = opts.weeklyRateKg ?? (goal === "lose" ? -0.5 : goal === "gain" ? 0.25 : 0);
  let calories = t + (rate * 7700) / 7;
  const floor = Math.max(1200, b ?? 1200);
  if (calories < floor) calories = floor;
  calories = Math.round(calories / 10) * 10;

  const weight = p.weight_kg || 65;
  const proteinPerKg = goal === "lose" ? 1.4 : goal === "gain" ? 1.6 : 1.1;
  const protein_g = Math.round(weight * proteinPerKg);
  const fat_g = Math.round((calories * 0.28) / 9);
  const carbs_g = Math.max(0, Math.round((calories - protein_g * 4 - fat_g * 9) / 4));
  const water_glasses = Math.max(8, Math.round((weight * 35) / 250));
  const steps = p.activity_level === "sedentary" ? 7000 : p.activity_level === "very_active" ? 12000 : 9000;

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g: round(Math.max(25, (calories / 1000) * 14)),
    water_glasses,
    steps,
    bmr: b,
    tdee: t,
  };
}
