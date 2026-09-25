/**
 * Daily + weekly wellness reports. Fully deterministic (no AI, no credits):
 * the same data always produces the same score, highlights and wording.
 * Wording is judgment-free — numbers are described, never graded as good/bad food.
 */
import { listMeals, listMealsInRange, sumNutrients } from "@/lib/domain/meals";
import { getTrackingDay, trackingInRange } from "@/lib/domain/tracking";
import { DEFAULT_TARGETS } from "@/lib/domain/targets";
import { addDays, dateRange, isISODate } from "@/lib/dates";
import { avoidList, conflictsWithAllergies } from "@/lib/allergens";
import { memoryDiets } from "@/lib/recipes-library";
import { formatNumber, round } from "@/lib/utils";
import type { Diet, Meal, Nutrients, Targets, TrackingDay, User } from "@/lib/types";

/* ───────────────────────────── Types ───────────────────────────── */

export type ScoreKey = "calories" | "protein" | "water" | "steps" | "fiber";

export interface ScorePart {
  key: ScoreKey;
  label: string;
  points: number;
  max: number;
  value: number;
  target: number;
  unit: string;
}

export interface DayTracking {
  water_glasses: number;
  steps: number;
  weight_kg?: number;
}

export interface DailyReport {
  date: string;
  is_today: boolean;
  totals: Nutrients;
  targets: Targets;
  meals: Meal[];
  tracking: DayTracking;
  /** 0–100, weighted: calories 35 · protein 25 · water 15 · steps 15 · fibre 10. */
  score: number;
  score_parts: ScorePart[];
  highlights: string[];
  suggestions: string[];
}

export interface WeeklyDay {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_glasses: number;
  steps: number;
  weight_kg?: number;
  meals_count: number;
  score: number;
}

export interface WeeklyAverages {
  /** Nutrition averages are over logged days (days with at least one meal). */
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  /** Water/steps averages are over days where they were tracked. */
  water_glasses: number;
  steps: number;
}

export interface WeeklyReport {
  start: string;
  end: string;
  days: WeeklyDay[];
  averages: WeeklyAverages;
  /** Logged days whose calories were within ±10% of the calorie target. */
  adherence: number;
  logged_days: number;
  best_day: { date: string; score: number } | null;
  /** First/last weigh-in of the week (entries = number of weigh-ins). */
  weight: { first: number; last: number; change: number; entries: number } | null;
  targets: Targets;
  summary: string;
}

/* ───────────────────────────── Helpers ───────────────────────────── */

/** A real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-31). */
export function isRealDate(s: unknown): s is string {
  if (!isISODate(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const resolveTargets = (user: Pick<User, "targets">): Targets => ({ ...DEFAULT_TARGETS, ...(user.targets || {}) });

const fmt = (n: number) => formatNumber(n);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const weekdayLong = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
};

const WEIGHTS: Record<ScoreKey, number> = { calories: 35, protein: 25, water: 15, steps: 15, fiber: 10 };

/** Within ±10% of the calorie target? */
const calorieWithin = (calories: number, target: number) => target > 0 && Math.abs(calories - target) / target <= 0.1;

/** Fraction (0–1) earned by each factor. Calories taper linearly from ±10% to ±50% off target. */
function fractions(totals: Nutrients, tracking: DayTracking, t: Targets, logged: boolean): Record<ScoreKey, number> {
  const ratio = (v: number, target: number) => (target > 0 ? Math.max(0, Math.min(1, v / target)) : 0);
  let calories = 0;
  if (logged && t.calories > 0) {
    const off = Math.abs(totals.calories - t.calories) / t.calories;
    calories = off <= 0.1 ? 1 : Math.max(0, 1 - (off - 0.1) / 0.4);
  }
  return {
    calories,
    protein: ratio(totals.protein_g, t.protein_g * 0.9),
    water: ratio(tracking.water_glasses, t.water_glasses),
    steps: ratio(tracking.steps, t.steps),
    fiber: ratio(totals.fiber_g, t.fiber_g),
  };
}

/** Weighted day score with its breakdown. Parts are rounded first so they always add up to the score. */
export function scoreDay(totals: Nutrients, tracking: DayTracking, targets: Targets, logged: boolean): { score: number; parts: ScorePart[] } {
  const f = fractions(totals, tracking, targets, logged);
  const parts: ScorePart[] = [
    { key: "calories", label: "Calories on target", value: totals.calories, target: targets.calories, unit: "kcal" },
    { key: "protein", label: "Protein", value: totals.protein_g, target: targets.protein_g, unit: "g" },
    { key: "water", label: "Water", value: tracking.water_glasses, target: targets.water_glasses, unit: "glasses" },
    { key: "steps", label: "Steps", value: tracking.steps, target: targets.steps, unit: "steps" },
    { key: "fiber", label: "Fibre", value: totals.fiber_g, target: targets.fiber_g, unit: "g" },
  ].map((p) => ({ ...p, key: p.key as ScoreKey, max: WEIGHTS[p.key as ScoreKey], points: Math.round(WEIGHTS[p.key as ScoreKey] * f[p.key as ScoreKey]) }));
  return { score: Math.max(0, Math.min(100, parts.reduce((s, p) => s + p.points, 0))), parts };
}

/* ─────────────────────── Food suggestions (diet + allergy aware) ─────────────────────── */

type DietClass = "vegan" | "vegetarian" | "eggetarian" | "non_vegetarian";

/** Every diet the person follows (profile + learned in chat) and everything they avoid. */
export interface FoodPrefs {
  diets: Diet[];
  avoid: string[];
}

interface ProteinSource {
  name: string;
  /** Words checked against allergies ("chickpeas" catches a chickpea allergy on "chana"). */
  words: string[];
  diet: DietClass;
  /** Fine for Jain diets (no root vegetables, sprouts, onion or garlic). */
  jain: boolean;
}

const PROTEIN: Record<string, ProteinSource> = {
  dal: { name: "dal", words: ["dal", "lentils", "toor dal", "moong dal", "legumes", "pulses"], diet: "vegan", jain: true },
  moong_dal: { name: "moong dal", words: ["moong dal", "lentils", "moong", "legumes", "pulses"], diet: "vegan", jain: true },
  chana: { name: "chana", words: ["chana", "chickpeas", "chole", "legumes", "pulses"], diet: "vegan", jain: true },
  rajma: { name: "rajma", words: ["rajma", "kidney beans", "beans", "legumes", "pulses"], diet: "vegan", jain: true },
  sprouts: { name: "sprouts", words: ["moong sprouts", "sprouts", "moong", "legumes", "pulses"], diet: "vegan", jain: false },
  tofu: { name: "tofu", words: ["tofu", "soy", "legumes", "pulses"], diet: "vegan", jain: true },
  soya: { name: "soya chunks", words: ["soya chunks", "soya", "soy", "legumes", "pulses"], diet: "vegan", jain: true },
  peanuts: { name: "roasted peanuts", words: ["roasted peanuts", "peanut", "legumes", "pulses"], diet: "vegan", jain: true },
  paneer: { name: "paneer", words: ["paneer"], diet: "vegetarian", jain: true },
  curd: { name: "curd", words: ["curd", "dahi"], diet: "vegetarian", jain: true },
  eggs: { name: "eggs", words: ["eggs"], diet: "eggetarian", jain: false },
  chicken: { name: "chicken", words: ["chicken"], diet: "non_vegetarian", jain: false },
  fish: { name: "fish", words: ["fish"], diet: "non_vegetarian", jain: false },
};

/** Preferred order per diet; the fallback list tops up when allergies rule some out. */
const PROTEIN_ORDER: Record<Diet | "any", string[]> = {
  vegan: ["tofu", "soya", "chana", "sprouts", "dal", "rajma", "peanuts"],
  jain: ["paneer", "curd", "moong_dal", "chana", "rajma", "tofu"],
  vegetarian: ["dal", "paneer", "curd", "sprouts", "chana", "rajma", "tofu"],
  eggetarian: ["eggs", "paneer", "curd", "dal", "chana", "sprouts"],
  non_vegetarian: ["eggs", "chicken", "fish", "dal", "paneer", "chana"],
  any: ["dal", "paneer", "curd", "eggs", "sprouts", "chana"],
};
const PROTEIN_FALLBACK = ["dal", "chana", "rajma", "moong_dal", "sprouts", "tofu", "soya", "paneer", "curd", "eggs", "chicken", "fish"];

const DIET_RANK: Record<DietClass, number> = { vegan: 0, vegetarian: 1, eggetarian: 2, non_vegetarian: 3 };
const DIET_MAX: Record<Diet, number> = { vegan: 0, jain: 1, vegetarian: 1, eggetarian: 2, non_vegetarian: 3 };

/** Fits every diet the person follows and none of their allergies. */
function proteinFits(src: ProteinSource, prefs: FoodPrefs): boolean {
  for (const d of prefs.diets) {
    if (DIET_RANK[src.diet] > DIET_MAX[d]) return false;
    if (d === "jain" && !src.jain) return false;
  }
  return !conflictsWithAllergies(src.words, prefs.avoid);
}

const joinOr = (list: string[]) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} or ${list[list.length - 1]}`);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Tofu, soya chunks, chana or sprouts" — up to four protein foods this person can eat. */
export function proteinSuggestion(prefs: FoodPrefs): string {
  // The strictest diet leads the order (vegan before vegetarian before non-veg).
  const lead = [...prefs.diets].sort((a, b) => DIET_MAX[a] - DIET_MAX[b] || (a === "jain" ? -1 : 1))[0];
  const order = [...new Set([...PROTEIN_ORDER[lead || "any"], ...PROTEIN_FALLBACK])];
  const picks = order
    .map((k) => PROTEIN[k])
    .filter((src) => proteinFits(src, prefs))
    .filter((src, _, all) => !(src === PROTEIN.moong_dal && all.includes(PROTEIN.dal)))
    .slice(0, 4)
    .map((src) => src.name);
  return picks.length ? capitalise(joinOr(picks)) : "A protein-rich food you can eat safely";
}

/** First phrasing whose foods are all safe for this person (the last option names no food). */
function firstSafe(options: Array<{ text: string; foods: string[] }>, prefs: FoodPrefs): string {
  const hit = options.find((o) => !o.foods.length || !conflictsWithAllergies(o.foods, prefs.avoid));
  return (hit || options[options.length - 1]).text;
}

const trackingOf = (d: Pick<TrackingDay, "water_glasses" | "steps" | "weight_kg"> | null | undefined): DayTracking => ({
  water_glasses: Math.max(0, Number(d?.water_glasses) || 0),
  steps: Math.max(0, Number(d?.steps) || 0),
  ...(d?.weight_kg ? { weight_kg: round(d.weight_kg, 1) } : {}),
});

/* ───────────────────────────── Daily ───────────────────────────── */

/** Positive, factual observations about the day (max 4). */
function dailyHighlights(totals: Nutrients, tracking: DayTracking, t: Targets, mealsCount: number, today: boolean): string[] {
  if (!mealsCount && !tracking.water_glasses && !tracking.steps) return [];
  const out: string[] = [];
  if (mealsCount && calorieWithin(totals.calories, t.calories)) {
    out.push(`Calories ${today ? "are" : "landed"} at ${fmt(totals.calories)} kcal — within 10% of your ${fmt(t.calories)} kcal target.`);
  }
  if (mealsCount && t.protein_g > 0 && totals.protein_g >= t.protein_g * 0.9) {
    out.push(`Protein reached ${fmt(totals.protein_g)} g — ${Math.round((totals.protein_g / t.protein_g) * 100)}% of your ${fmt(t.protein_g)} g goal.`);
  }
  if (t.water_glasses > 0 && tracking.water_glasses >= t.water_glasses) {
    out.push(`Water goal met: ${tracking.water_glasses} of ${t.water_glasses} glasses.`);
  }
  if (t.steps > 0 && tracking.steps >= t.steps) {
    out.push(`${fmt(tracking.steps)} steps — you reached your ${fmt(t.steps)} step goal.`);
  }
  if (mealsCount && t.fiber_g > 0 && totals.fiber_g >= t.fiber_g * 0.9) {
    out.push(`Fibre came to ${fmt(totals.fiber_g)} g of your ${fmt(t.fiber_g)} g target.`);
  }
  if (out.length < 4 && mealsCount >= 3) out.push(`${plural(mealsCount, "meal")} logged — a complete picture of the day.`);
  if (!out.length && mealsCount) out.push(`${plural(mealsCount, "meal")} logged — every entry makes your insights sharper.`);
  if (!out.length && (tracking.water_glasses || tracking.steps)) out.push("You tracked your day — small check-ins add up.");
  return out.slice(0, 4);
}

/** Gentle, practical next steps (max 3), most useful first. */
function dailySuggestions(totals: Nutrients, tracking: DayTracking, t: Targets, mealsCount: number, today: boolean, prefs: FoodPrefs): string[] {
  const out: string[] = [];
  const is = today ? "is" : "was";

  if (!mealsCount) {
    out.push(
      today
        ? "Log your first meal by photo, text or voice — this report fills in as you go."
        : "Nothing was logged on this day. Even one logged meal a day builds a useful picture over time."
    );
  } else if (t.calories > 0) {
    const gap = Math.round(Math.abs(totals.calories - t.calories));
    if (totals.calories < t.calories * 0.9) {
      const plate = firstSafe(
        [
          { text: "dal, sabzi and a roti or rice", foods: ["dal", "sabzi", "roti", "rice"] },
          { text: "dal, sabzi and rice", foods: ["dal", "sabzi", "rice"] },
          { text: "sabzi with rice or a millet roti", foods: ["sabzi", "rice", "millet"] },
          { text: "a protein, a vegetable and a grain you can eat", foods: [] },
        ],
        prefs
      );
      const snack = firstSafe(
        [
          { text: "roasted chana or a fruit", foods: ["roasted chana", "chickpeas", "fruit"] },
          { text: "a fruit", foods: ["fruit"] },
          { text: "a small snack you can eat safely", foods: [] },
        ],
        prefs
      );
      out.push(
        today
          ? `About ${fmt(gap)} kcal left for today. A balanced plate — ${plate} — fits comfortably.`
          : `Calories were about ${fmt(gap)} kcal below target. If energy felt low, a balanced snack like ${snack} helps.`
      );
    } else if (totals.calories > t.calories * 1.1) {
      out.push(
        `Calories ${is} about ${fmt(gap)} kcal above target. One day never defines progress — lighter, fibre-rich meals ${
          today ? "for the rest of the day" : "the next day"
        } balance it naturally.`
      );
      if (totals.calories > t.calories * 1.2) out.push("If it was a special occasion, Rebalance can spread it gently over the next few days.");
    }
  }

  if (mealsCount && t.protein_g > 0 && totals.protein_g < t.protein_g * 0.9) {
    const pct = Math.round((totals.protein_g / t.protein_g) * 100);
    out.push(`Protein ${is} at ${pct}% of your ${fmt(t.protein_g)} g goal. ${proteinSuggestion(prefs)} in ${today ? "your next meal can" : "a meal would"} close the gap.`);
  }
  if (t.water_glasses > 0 && tracking.water_glasses < t.water_glasses) {
    const need = t.water_glasses - tracking.water_glasses;
    if (!tracking.water_glasses) {
      out.push(
        today
          ? `Aim for ${t.water_glasses} glasses of water across the day — a glass with each meal is an easy start.`
          : `No water was tracked on this day — your goal is ${t.water_glasses} glasses.`
      );
    } else {
      out.push(`${plural(need, "more glass", "more glasses")} of water ${today ? "would reach" : "would have reached"} your goal of ${t.water_glasses}.`);
    }
  }
  if (mealsCount && t.fiber_g > 0 && totals.fiber_g < t.fiber_g * 0.7) {
    const fibre = firstSafe(
      [
        { text: "whole grains, fruit, salads and dals", foods: ["whole grains", "fruit", "salads", "dal"] },
        { text: "fruit, salads and dals", foods: ["fruit", "salads", "dal"] },
        { text: "fruit, salads and vegetables", foods: ["fruit", "salads", "vegetables"] },
        { text: "vegetables and other fibre-rich foods you can eat", foods: [] },
      ],
      prefs
    );
    out.push(`Fibre ${is} ${fmt(totals.fiber_g)} g of ${fmt(t.fiber_g)} g — ${fibre} add more.`);
  }
  if (t.steps > 0 && tracking.steps < t.steps * 0.7) {
    out.push("An easy 10-minute walk after a meal adds roughly 1,000 steps.");
  }
  return out.slice(0, 3);
}

/** Profile diet + diets learned in chat, and profile allergies + avoided foods learned in chat. */
export function foodPrefs(user: Pick<User, "profile" | "memory">): FoodPrefs {
  const diet = user.profile?.diet;
  const strictness: Record<Diet, number> = { vegan: 0, jain: 1, vegetarian: 2, eggetarian: 3, non_vegetarian: 4 };
  return {
    // strictest first, so a single label ("Vegan") describes the lead diet
    diets: [...new Set<Diet>([...(diet ? [diet] : []), ...memoryDiets(user.memory)])].sort((a, b) => strictness[a] - strictness[b]),
    avoid: avoidList(user.profile?.allergies, user.memory).filter((a) => !/^(none|no|nil)$/i.test(a.trim())),
  };
}

export async function buildDailyReport(user: User, date: string, today: string): Promise<DailyReport> {
  const targets = resolveTargets(user);
  const [meals, day] = await Promise.all([listMeals(user.id, date), getTrackingDay(user.id, date)]);
  const totals = sumNutrients(meals.map((m) => m.totals));
  const tracking = trackingOf(day);
  const isToday = date === today;
  const { score, parts } = scoreDay(totals, tracking, targets, meals.length > 0);
  return {
    date,
    is_today: isToday,
    totals,
    targets,
    meals,
    tracking,
    score,
    score_parts: parts,
    highlights: dailyHighlights(totals, tracking, targets, meals.length, isToday),
    suggestions: dailySuggestions(totals, tracking, targets, meals.length, isToday, foodPrefs(user)),
  };
}

/* ───────────────────────────── Weekly ───────────────────────────── */

const avg = (list: number[], digits = 0) => (list.length ? round(list.reduce((s, v) => s + v, 0) / list.length, digits) : 0);

function weeklySummary(r: Omit<WeeklyReport, "summary">): string {
  const t = r.targets;
  if (!r.logged_days) {
    const tracked = r.days.some((d) => d.water_glasses || d.steps);
    return tracked
      ? "No meals logged this week yet, but you tracked water or steps — a good start. Snap, type or speak a meal and ÖRZA will build the rest of your weekly picture."
      : "Nothing logged this week yet. Snap, type or speak a meal and ÖRZA will build your weekly picture from there.";
  }
  const a = r.averages;
  const parts: string[] = [`You logged meals on ${r.logged_days} of 7 days.`];
  parts.push(
    r.adherence
      ? `${r.adherence === r.logged_days ? (r.logged_days === 1 ? "That day" : "All of them") : `${r.adherence} of them`} landed within 10% of your ${fmt(t.calories)} kcal target, with an average of ${fmt(a.calories)} kcal.`
      : `Calories averaged ${fmt(a.calories)} kcal against a ${fmt(t.calories)} kcal target — the weekly average matters more than any single day.`
  );
  if (t.protein_g > 0) parts.push(`Protein averaged ${fmt(a.protein_g)} g, ${Math.round((a.protein_g / t.protein_g) * 100)}% of your ${fmt(t.protein_g)} g goal.`);
  const move: string[] = [];
  if (a.water_glasses) move.push(`${a.water_glasses} ${a.water_glasses === 1 ? "glass" : "glasses"} of water`);
  if (a.steps) move.push(`${fmt(a.steps)} steps`);
  if (move.length) parts.push(`On tracked days you averaged ${move.join(" and ")} a day.`);
  if (r.best_day && r.logged_days > 1) parts.push(`${weekdayLong(r.best_day.date)} was your most balanced day (score ${r.best_day.score}).`);
  if (r.weight) {
    parts.push(
      r.weight.entries === 1
        ? `You logged a weigh-in of ${r.weight.last} kg.`
        : r.weight.change === 0
          ? `Your weight held steady at ${r.weight.last} kg.`
          : `Your weigh-ins moved from ${r.weight.first} kg to ${r.weight.last} kg.`
    );
  }
  return parts.join(" ");
}

export async function buildWeeklyReport(user: User, end: string): Promise<WeeklyReport> {
  const targets = resolveTargets(user);
  const start = addDays(end, -6);
  const [meals, tracking] = await Promise.all([listMealsInRange(user.id, start, end), trackingInRange(user.id, start, end)]);

  const mealsByDate = new Map<string, Meal[]>();
  for (const m of meals) mealsByDate.set(m.date, [...(mealsByDate.get(m.date) || []), m]);
  const trackByDate = new Map(tracking.map((t) => [t.date, t]));

  const days: WeeklyDay[] = dateRange(start, 7).map((date) => {
    const list = mealsByDate.get(date) || [];
    const totals = sumNutrients(list.map((m) => m.totals));
    const tr = trackingOf(trackByDate.get(date));
    return {
      date,
      ...totals,
      water_glasses: tr.water_glasses,
      steps: tr.steps,
      ...(tr.weight_kg ? { weight_kg: tr.weight_kg } : {}),
      meals_count: list.length,
      score: scoreDay(totals, tr, targets, list.length > 0).score,
    };
  });

  const logged = days.filter((d) => d.meals_count > 0);
  const averages: WeeklyAverages = {
    calories: avg(logged.map((d) => d.calories)),
    protein_g: avg(logged.map((d) => d.protein_g), 1),
    carbs_g: avg(logged.map((d) => d.carbs_g), 1),
    fat_g: avg(logged.map((d) => d.fat_g), 1),
    fiber_g: avg(logged.map((d) => d.fiber_g), 1),
    water_glasses: avg(days.filter((d) => d.water_glasses > 0).map((d) => d.water_glasses), 1),
    steps: avg(days.filter((d) => d.steps > 0).map((d) => d.steps)),
  };

  // Highest score wins; ties go to the later day.
  const best = logged.reduce<WeeklyDay | null>((b, d) => (!b || d.score >= b.score ? d : b), null);
  const weighIns = days.filter((d) => d.weight_kg);
  const weight = weighIns.length
    ? {
        first: weighIns[0].weight_kg!,
        last: weighIns[weighIns.length - 1].weight_kg!,
        change: round(weighIns[weighIns.length - 1].weight_kg! - weighIns[0].weight_kg!, 1),
        entries: weighIns.length,
      }
    : null;

  const base: Omit<WeeklyReport, "summary"> = {
    start,
    end,
    days,
    averages,
    adherence: logged.filter((d) => calorieWithin(d.calories, targets.calories)).length,
    logged_days: logged.length,
    best_day: best ? { date: best.date, score: best.score } : null,
    weight,
    targets,
  };
  return { ...base, summary: weeklySummary(base) };
}
