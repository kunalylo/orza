/**
 * Pure goal-planning helpers shared by the /api/goals/calculate route and the
 * goal calculator's live preview (safe to import on client and server).
 */
import type { GoalType, Profile, Targets } from "@/lib/types";
import { computeTargets } from "@/lib/domain/targets";
import { addDays } from "@/lib/dates";
import { round } from "@/lib/utils";

export const KCAL_PER_KG = 7700;
/** Safety limits: loss ≤ 1 kg/week, gain ≤ 0.5 kg/week. */
export const MAX_LOSS_PER_WEEK = 1;
export const MAX_GAIN_PER_WEEK = 0.5;
export const HEALTHY_BMI_FLOOR = 18.5;

export const LOSS_PACES = [
  { rate: 0.25, label: "Gentle" },
  { rate: 0.5, label: "Steady" },
  { rate: 0.75, label: "Faster" },
] as const;
export const GAIN_PACES = [{ rate: 0.25, label: "Lean" }] as const;

export const GOAL_LABEL: Record<GoalType, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

/** Default signed weekly change for a goal (negative = loss). */
export function defaultRate(goal: GoalType): number {
  return goal === "lose" ? -0.5 : goal === "gain" ? 0.25 : 0;
}

/** Normalises a requested pace to the goal's direction (loss negative, gain positive, maintain 0). */
export function signedRate(goal: GoalType, rate?: number | null): number {
  if (goal === "maintain") return 0;
  const r = Math.abs(Number(rate) || 0);
  if (!r) return defaultRate(goal);
  return goal === "lose" ? -r : r;
}

export function bmiFor(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return round(weightKg / (m * m), 1);
}

/** Lowest weight inside the healthy BMI range for a height (rounded up to 0.5 kg). */
export function healthyFloorKg(heightCm: number): number {
  const m = heightCm / 100;
  return Math.ceil(HEALTHY_BMI_FLOOR * m * m * 2) / 2;
}

/** Friendly validation message, or null when the goal is safe and consistent. */
export function goalInputError(i: { goal: GoalType; current: number; target: number; rate: number; heightCm?: number }): string | null {
  const { goal, current, target, rate, heightCm } = i;
  if (!(current >= 25 && current <= 350)) return "Enter a current weight between 25 and 350 kg.";
  if (!(target >= 25 && target <= 350)) return "Enter a target weight between 25 and 350 kg.";
  if (goal === "lose") {
    if (target >= current) return "For weight loss, your target should be below your current weight.";
    if (rate < -MAX_LOSS_PER_WEEK) return "To keep things safe, ÖRZA plans weight loss at 1 kg a week or less.";
    if (heightCm && target < healthyFloorKg(heightCm)) {
      return `That target sits below the healthy range for your height. Try ${healthyFloorKg(heightCm)} kg or above — or check with your doctor first.`;
    }
  }
  if (goal === "gain") {
    if (target <= current) return "For weight gain, your target should be above your current weight.";
    if (rate > MAX_GAIN_PER_WEEK) return "To keep things safe, ÖRZA plans weight gain at 0.5 kg a week or less.";
  }
  return null;
}

export type GoalPlan = {
  targets: Targets;
  bmr: number | null;
  tdee: number | null;
  /** Planned weekly change after safety floors (negative = loss). */
  weeklyRate: number;
  /** True when the calorie floor made the pace gentler than requested. */
  paceAdjusted: boolean;
  weeks: number | null;
  targetDate: string | null;
  /** Set when a plan can't be made safely (e.g. no room for a deficit). */
  blocker: string | null;
};

/**
 * Daily targets + timeline for a goal. `profile` should already contain the
 * current weight, height, age, sex and activity level.
 */
export function planGoal(opts: { profile: Profile; goal: GoalType; current: number; target: number; rate: number; today: string }): GoalPlan {
  const { profile, goal, current, target, today } = opts;
  const rate = signedRate(goal, opts.rate);
  const full = computeTargets({ ...profile, weight_kg: current }, { goal, weeklyRateKg: rate });
  const { bmr, tdee, ...targets } = full;

  let weeklyRate = rate;
  let paceAdjusted = false;
  let blocker: string | null = null;

  if (tdee != null && goal === "lose") {
    const planned = Math.round((tdee + (rate * KCAL_PER_KG) / 7) / 10) * 10;
    if (targets.calories > planned) {
      // The 1200 kcal / BMR floor kicked in — plan at the pace the floor actually allows.
      weeklyRate = round(((targets.calories - tdee) * 7) / KCAL_PER_KG, 2);
      paceAdjusted = true;
      if (weeklyRate > -0.05) {
        blocker =
          "Your daily energy needs are already close to the safe minimum, so ÖRZA won't plan a calorie deficit. A maintain goal with more movement is a kinder place to start — or chat with a nutritionist.";
      }
    }
  }

  let weeks: number | null = null;
  let targetDate: string | null = null;
  if (goal !== "maintain" && weeklyRate !== 0 && !blocker) {
    weeks = Math.max(1, Math.ceil(Math.abs(target - current) / Math.abs(weeklyRate)));
    targetDate = addDays(today, weeks * 7);
  }

  return { targets, bmr, tdee, weeklyRate, paceAdjusted, weeks, targetDate, blocker };
}

/** "12 Mar 2027" from YYYY-MM-DD (timezone-free). */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Thu, 24 Sep" from YYYY-MM-DD. */
export function formatDayDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "24 Sep" from YYYY-MM-DD. */
export function formatShortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Whole days between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function formatKg(n: number): string {
  return `${round(n, 1).toLocaleString("en-IN", { maximumFractionDigits: 1 })} kg`;
}
