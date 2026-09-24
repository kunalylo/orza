/**
 * Deterministic "ÖRZA says" one-liner for the Today screen.
 * Warm, judgment-free, and diet-aware — no AI call, so it is free and instant.
 */
import type { Diet, Nutrients, Targets } from "@/lib/types";
import { clamp, formatNumber } from "@/lib/utils";

export type InsightInput = {
  /** Viewing the user's current day (time-of-day rules apply) vs. looking back. */
  isToday: boolean;
  /** Local hour 0–23 in the user's timezone. */
  hour: number;
  mealsCount: number;
  totals: Nutrients;
  targets: Targets;
  water: number;
  diet?: Diet;
};

type DietKey = Diet | "default";

const PROTEIN_IDEAS: Record<DietKey, string> = {
  vegan: "a katori of dal, chana chaat or tofu bhurji",
  jain: "a katori of moong dal or paneer tikka",
  vegetarian: "a katori of dal or paneer tikka",
  eggetarian: "a katori of dal, paneer tikka or two boiled eggs",
  non_vegetarian: "a katori of dal, grilled chicken or two boiled eggs",
  default: "a katori of dal or paneer tikka",
};

const BREAKFAST_IDEAS: Record<DietKey, string> = {
  vegan: "poha with peanuts or a besan chilla",
  jain: "a moong dal chilla or a bowl of dalia",
  vegetarian: "a besan chilla, poha with peanuts or curd with fruit",
  eggetarian: "a besan chilla or egg bhurji with toast",
  non_vegetarian: "a besan chilla or egg bhurji with toast",
  default: "a besan chilla or poha with peanuts",
};

const LIGHT_IDEAS: Record<DietKey, string> = {
  vegan: "dal-khichdi or a veggie-loaded soup",
  jain: "moong dal khichdi or a bowl of lauki sabzi",
  vegetarian: "dal-khichdi or a veggie-loaded soup",
  eggetarian: "dal-khichdi or a veggie-loaded soup",
  non_vegetarian: "dal-khichdi or a clear chicken soup",
  default: "dal-khichdi or a veggie-loaded soup",
};

const kcal = (n: number) => `${formatNumber(n)} kcal`;

export function buildInsight(i: InsightInput): string {
  const d: DietKey = i.diet || "default";
  const target = Math.max(1, i.targets.calories);
  const eaten = i.totals.calories;
  const kcalLeft = Math.round(target - eaten);
  const proteinLeft = Math.round(i.targets.protein_g - i.totals.protein_g);

  /* ─── Looking back at a past day ─── */
  if (!i.isToday) {
    if (i.mealsCount === 0) return "Nothing was logged on this day — that's okay. Every day is a fresh start.";
    const diff = eaten - target;
    if (Math.abs(diff) <= target * 0.1) {
      return proteinLeft <= 5
        ? `A well-balanced day — you landed within ${kcal(Math.abs(diff))} of your target and covered your protein.`
        : `A well-balanced day — you landed within ${kcal(Math.abs(diff))} of your target.`;
    }
    if (diff > 0) return `This day ran about ${kcal(diff)} over target — totally human. One balanced day brings things back in line.`;
    if (i.mealsCount <= 1 && eaten < target * 0.6) {
      return "Only one meal was logged this day. If you missed some, you can still add them — ÖRZA keeps the picture complete.";
    }
    return `You ate about ${kcal(-diff)} under target this day. Steady, regular meals keep energy up — no need to make up for it.`;
  }

  /* ─── Today ─── */
  const h = i.hour;
  // Rough share of the day's intake typically eaten by now (7am → 0, 9pm → 1).
  const dayProgress = clamp((h - 7) / 14, 0, 1);

  if (i.mealsCount === 0) {
    if (h < 5) return "It's a quiet hour. Whenever you're ready, log your first meal and ÖRZA will take it from there.";
    if (h < 11) return `Good morning — a protein-rich breakfast like ${BREAKFAST_IDEAS[d]} sets a steady tone for the day.`;
    if (h < 16) return "Nothing logged yet today. Snap your plate or just tell ÖRZA what you ate — it takes seconds.";
    return "No meals logged yet today — that's okay. Add what you've had so far and ÖRZA will help balance the rest.";
  }

  if (kcalLeft < 0) {
    const over = -kcalLeft;
    if (over <= 150) return `You're just ${kcal(over)} past your target — practically spot on. Nothing to fix here.`;
    if (h >= 20 || h < 5) {
      return `You're ${kcal(over)} over today — completely human. Tomorrow is a fresh page, and Rebalance can spread it gently over a few days.`;
    }
    return `You're ${kcal(over)} over today — no guilt, it happens. A lighter dinner like ${LIGHT_IDEAS[d]}, or an evening walk, evens things out.`;
  }

  if (kcalLeft <= 150 && proteinLeft <= 10) {
    return kcalLeft <= 20
      ? "Right on your calorie target, with protein covered. Beautifully balanced."
      : `Beautifully balanced — you're within ${kcal(kcalLeft)} of your target and protein is covered.`;
  }

  if (proteinLeft >= 15 && (h >= 15 || i.totals.protein_g < i.targets.protein_g * (dayProgress - 0.25))) {
    return `You're ${proteinLeft} g short on protein — ${PROTEIN_IDEAS[d]} would close the gap.`;
  }

  if (h >= 12 && i.targets.water_glasses > 0 && i.water < Math.floor(i.targets.water_glasses * dayProgress) - 1) {
    return `You're at ${i.water} of ${i.targets.water_glasses} glasses of water — keep a bottle within reach; small sips add up.`;
  }

  if (h >= 18 && kcalLeft >= 500) {
    return `You still have ${kcal(kcalLeft)} for today — a balanced dinner like dal, a sabzi and two rotis would fit nicely.`;
  }

  if (proteinLeft <= 0) return `Protein's covered for the day — nice work. You have ${kcal(kcalLeft)} left to enjoy, mindfully.`;

  return `${kcal(kcalLeft)} and ${proteinLeft} g protein to go — you're pacing well. Keep listening to your hunger.`;
}
