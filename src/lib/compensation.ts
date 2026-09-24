/**
 * Compassionate rebalancing — deterministic recovery plans after a special meal.
 *
 * The surplus is spread over 2–5 days starting tomorrow. Each day's trim stays
 * ≤ 15% of the usual target (10% on a gain goal) and never takes calories below
 * max(1200, BMR). Whatever the trims don't cover becomes a little added movement
 * (capped at a comfortable walk); anything beyond that is simply left to even out.
 * The AI route may reword the message and meal ideas, but never these numbers.
 */
import type { CompensationDay, CompensationPlan, Diet, Profile, Targets } from "@/lib/types";
import { bmr } from "@/lib/domain/targets";
import { addDays } from "@/lib/dates";
import { parseMealText } from "@/lib/nutrition";
import { clamp, formatNumber } from "@/lib/utils";

export const KCAL_PER_STEP = 0.04;
export const KCAL_PER_WALK_MIN = 4; // brisk walk, ~100 steps a minute
export const MAX_WALK_MIN_PER_DAY = 45;
export const DEFAULT_EXTRA_CALORIES = 600;

export interface CompensationSummary {
  usual_calories: number;
  floor_calories: number;
  food_kcal: number; // total gently trimmed from meals
  activity_kcal: number; // total covered by added movement
  released_kcal: number; // left to even out naturally
  avg_daily_trim: number;
  walk_minutes_per_day: number;
  extra_steps_per_day: number;
  back_to_usual: string; // first day after the plan (YYYY-MM-DD)
}

/** What gets stored in `compensation_plans` (CompensationPlan + a few display extras). */
export type StoredCompensationPlan = CompensationPlan & {
  description?: string;
  summary?: CompensationSummary;
  ai?: boolean;
  estimated?: boolean; // extra_calories was estimated rather than entered
};

export interface CompensationDraft {
  extra_calories: number;
  days: CompensationDay[];
  message: string;
  summary: CompensationSummary;
}

/* ───────────────────────────── meal ideas ───────────────────────────── */

type Kind = "vegan" | "veg" | "egg" | "nonveg";
type Allergen = "dairy" | "nuts" | "gluten" | "soy" | "egg" | "fish";
type Idea = { text: string; kind: Kind; jain?: boolean; allergens?: Allergen[] };

const BREAKFASTS: Idea[] = [
  { text: "Moong dal chilla with coriander chutney", kind: "vegan", jain: true },
  { text: "Poha with peas and lemon (no onion)", kind: "vegan", jain: true },
  { text: "Idli (2) with coconut chutney", kind: "vegan", jain: true },
  { text: "Hung curd bowl with fruit and chia seeds", kind: "veg", jain: true, allergens: ["dairy"] },
  { text: "Ragi porridge with milk and sliced banana", kind: "veg", jain: true, allergens: ["dairy"] },
  { text: "Vegetable oats upma with a squeeze of lemon", kind: "vegan", allergens: ["gluten"] },
  { text: "Sprouts chaat with cucumber, tomato and lemon", kind: "vegan" },
  { text: "Paneer-stuffed besan chilla with mint chutney", kind: "veg", allergens: ["dairy"] },
  { text: "Tofu bhurji with a multigrain toast", kind: "vegan", allergens: ["soy", "gluten"] },
  { text: "2-egg vegetable omelette with a multigrain toast", kind: "egg", allergens: ["egg", "gluten"] },
  { text: "2 boiled eggs, a fruit and chai with less sugar", kind: "egg", allergens: ["egg", "dairy"] },
];

const LUNCHES: Idea[] = [
  { text: "2 phulka, plain moong dal and a big cucumber-tomato salad", kind: "vegan", jain: true, allergens: ["gluten"] },
  { text: "Jowar roti with lauki chana dal and salad", kind: "vegan", jain: true },
  { text: "Millet khichdi with a bowl of curd", kind: "veg", jain: true, allergens: ["dairy"] },
  { text: "1 katori brown rice with rajma and kachumber salad", kind: "vegan" },
  { text: "Chole with 1 phulka and a big salad", kind: "vegan", allergens: ["gluten"] },
  { text: "Paneer bhurji with 2 phulka and salad", kind: "veg", allergens: ["dairy", "gluten"] },
  { text: "Quinoa vegetable pulao with cucumber raita", kind: "veg", allergens: ["dairy"] },
  { text: "Tofu and vegetable stir-fry with 1 katori brown rice", kind: "vegan", allergens: ["soy"] },
  { text: "Egg curry with 1 phulka and salad", kind: "egg", allergens: ["egg", "gluten"] },
  { text: "Grilled chicken with 1 phulka and sautéed vegetables", kind: "nonveg", allergens: ["gluten"] },
  { text: "Light fish curry with 1 katori rice and salad", kind: "nonveg", allergens: ["fish"] },
  { text: "Grilled chicken salad bowl with chickpeas and greens", kind: "nonveg" },
];

const DINNERS: Idea[] = [
  { text: "Moong dal khichdi with a side salad", kind: "vegan", jain: true },
  { text: "Lauki sabzi, 1 phulka and a bowl of dal", kind: "vegan", jain: true, allergens: ["gluten"] },
  { text: "Paneer and capsicum stir-fry with a bowl of tomato soup", kind: "veg", jain: true, allergens: ["dairy"] },
  { text: "Vegetable daliya with a bowl of curd", kind: "veg", jain: true, allergens: ["gluten", "dairy"] },
  { text: "Palak dal with 1 jowar roti", kind: "vegan" },
  { text: "Clear vegetable soup with paneer tikka", kind: "veg", allergens: ["dairy"] },
  { text: "Grilled tofu with stir-fried vegetables", kind: "vegan", allergens: ["soy"] },
  { text: "Egg bhurji with sautéed vegetables and 1 phulka", kind: "egg", allergens: ["egg", "gluten"] },
  { text: "Chicken clear soup with grilled chicken tikka", kind: "nonveg", allergens: ["dairy"] },
  { text: "Steamed fish with sautéed greens and a small portion of rice", kind: "nonveg", allergens: ["fish"] },
];

const ALLERGEN_WORDS: Record<Allergen, string[]> = {
  dairy: ["dairy", "milk", "lactose", "paneer", "curd", "cheese", "ghee"],
  nuts: ["nut", "peanut", "almond", "cashew", "walnut", "pista"],
  gluten: ["gluten", "wheat", "celiac", "coeliac"],
  soy: ["soy", "soya", "tofu"],
  egg: ["egg"],
  fish: ["fish", "seafood", "shellfish", "prawn", "shrimp"],
};

function allergensFor(profile: Profile): Set<Allergen> {
  const text = (profile.allergies || []).join(" ").toLowerCase();
  const out = new Set<Allergen>();
  (Object.keys(ALLERGEN_WORDS) as Allergen[]).forEach((a) => {
    if (ALLERGEN_WORDS[a].some((w) => text.includes(w))) out.add(a);
  });
  return out;
}

function fitsDiet(idea: Idea, diet?: Diet): boolean {
  switch (diet) {
    case "vegan":
      return idea.kind === "vegan";
    case "jain":
      return (idea.kind === "vegan" || idea.kind === "veg") && !!idea.jain;
    case "eggetarian":
      return idea.kind !== "nonveg";
    case "non_vegetarian":
      return true;
    default:
      // Vegetarian (or not set yet) — ideas that suit every Indian kitchen.
      return idea.kind === "vegan" || idea.kind === "veg";
  }
}

function candidates(pool: Idea[], profile: Profile): Idea[] {
  const avoid = allergensFor(profile);
  const byDiet = pool.filter((i) => fitsDiet(i, profile.diet));
  const safe = byDiet.filter((i) => !(i.allergens || []).some((a) => avoid.has(a)));
  if (safe.length) return safe;
  // Never return nothing: fall back to allergen-free vegan staples.
  const fallback = pool.filter((i) => i.kind === "vegan" && !(i.allergens || []).length);
  return fallback.length ? fallback : pool.slice(0, 1);
}

function seedFrom(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Three meal ideas per day, rotated so consecutive days don't repeat. */
function mealIdeas(profile: Profile, dayIndex: number, seed: number): string[] {
  const pick = (label: string, pool: Idea[], offset: number) => {
    const list = candidates(pool, profile);
    return `${label}: ${list[(seed + offset + dayIndex) % list.length].text}`;
  };
  return [pick("Breakfast", BREAKFASTS, 0), pick("Lunch", LUNCHES, 3), pick("Dinner", DINNERS, 7)];
}

/* ───────────────────────────── day details ───────────────────────────── */

function focusFor(i: number, n: number): string {
  if (i === 0) return "Light & protein-forward";
  if (i === 1) return "Extra fibre + hydration";
  if (i === n - 1) return "Easing back to your usual rhythm";
  return i === 2 ? "Balanced & unhurried" : "Colourful plates, mindful portions";
}

function activityFor(i: number, walkMin: number, extraSteps: number, usualSteps: number): string {
  if (walkMin <= 0) {
    return [
      "A relaxed 10–15 minute walk after your biggest meal helps digestion.",
      "Keep to your usual steps — 15 minutes of gentle yoga or stretching is a lovely bonus.",
      "An easy evening stroll with family or a friend.",
      "Take the stairs where you can and keep water nearby.",
      "Your usual routine is plenty today — just keep moving through the day.",
    ][i % 5];
  }
  const steps = formatNumber(extraSteps);
  const total = formatNumber(usualSteps + extraSteps);
  const half = Math.max(5, Math.round(walkMin / 2 / 5) * 5);
  return [
    `Add a ${walkMin}-minute brisk walk — about ${steps} extra steps (${total} for the day).`,
    `Split it up: two ${half}-minute walks after lunch and dinner (~${steps} extra steps).`,
    `${walkMin} minutes of brisk walking, cycling or a dance session you enjoy (~${steps} extra steps).`,
    `Take the stairs and add a ${walkMin}-minute evening walk (~${steps} extra steps).`,
    `An easy ${walkMin}-minute walk plus 10 minutes of stretching (~${steps} extra steps).`,
  ][i % 5];
}

function longWeekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
}

function cleanOccasion(o?: string): string {
  const t = (o || "").replace(/\s+/g, " ").trim().slice(0, 80);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/** Sentence subject for the occasion: "The wedding", "Your vacation", "Diwali". */
function occasionSubject(o?: string): string {
  const t = cleanOccasion(o);
  if (!t) return "It";
  const lower = t.toLowerCase();
  if (/^(the|my|our|a|an|your)\s/.test(lower)) return t;
  if (/^(wedding|birthday|festival|party|anniversary|celebration|feast|reunion)$/.test(lower)) return `The ${lower}`;
  if (/^(vacation|holiday|trip)$/.test(lower)) return `Your ${lower}`;
  return t;
}

function buildMessage(o: { occasion?: string; name?: string; n: number; avgTrim: number; walkMin: number; released: number; backTo: string; extra: number }): string {
  const first = (o.name || "").trim().split(/\s+/)[0];
  // What ÖRZA will do, in words (trims can be 0 when targets already sit at the safe floor).
  const action =
    o.avgTrim > 0
      ? `${o.extra < 350 ? "trims" : "gently trims"} about ${o.avgTrim} kcal a day${o.walkMin > 0 ? " and adds a little movement" : ""}`
      : "keeps your meals just as they are and adds a little easy movement";
  const parts: string[] = [];
  if (o.extra < 350) {
    parts.push(
      `${first ? `${first}, a` : "A"} small bump like this barely registers in the bigger picture.`,
      `Over the next ${o.n} days ÖRZA ${action} — you'll hardly notice it.`,
      "Enjoy the memories; no guilt needed."
    );
  } else {
    parts.push(
      `One celebration doesn't undo your progress${first ? `, ${first}` : ""}.`,
      `${occasionSubject(o.occasion)} was worth enjoying — over the next ${o.n} days ÖRZA ${action}, so you're back in your usual rhythm by ${longWeekday(o.backTo)}.`,
      "No skipped meals, no guilt — just steady, kind choices."
    );
  }
  if (o.released > 0) {
    parts.push(`The remaining ~${formatNumber(o.released)} kcal will simply even out over the coming week — one meal is never the whole story.`);
  }
  return parts.join(" ");
}

/* ───────────────────────────── public API ───────────────────────────── */

export function planCompensation(input: {
  extra_calories: number;
  days: number;
  targets: Targets;
  profile: Profile;
  /** First day of the plan (usually tomorrow in the user's timezone). */
  startDate: string;
  occasion?: string;
  name?: string;
}): CompensationDraft {
  const profile = input.profile || {};
  const extra = Math.round(clamp(Number(input.extra_calories) || 0, 0, 5000));
  const n = Math.round(clamp(Number(input.days) || 3, 2, 5));
  const usual = Math.max(1200, Math.round(Number(input.targets?.calories) || 2000));
  const usualSteps = Math.round(Number(input.targets?.steps) || 8000);
  const floor = Math.max(1200, bmr(profile) ?? 1200);
  const share = profile.goal === "gain" ? 0.1 : 0.15;
  const maxCut = Math.max(0, Math.min(Math.floor((usual * share) / 10) * 10, Math.floor((usual - floor) / 10) * 10));

  // Meal trims first (cumulative rounding keeps the total exact to 10 kcal).
  const foodTotal = Math.min(extra, maxCut * n);
  const r10 = (x: number) => Math.round(x / 10) * 10;
  const cuts = Array.from({ length: n }, (_, i) => Math.min(maxCut, r10((foodTotal * (i + 1)) / n) - r10((foodTotal * i) / n)));
  const food = cuts.reduce((a, b) => a + b, 0);

  // Then a comfortable walk for what's left.
  const leftover = Math.max(0, extra - food);
  const walkMin = leftover > 0 ? Math.min(MAX_WALK_MIN_PER_DAY, Math.ceil(leftover / n / KCAL_PER_WALK_MIN / 5) * 5) : 0;
  const extraSteps = Math.round((walkMin * KCAL_PER_WALK_MIN) / KCAL_PER_STEP / 500) * 500;
  const activity = Math.min(leftover, walkMin * KCAL_PER_WALK_MIN * n);
  const released = Math.max(0, extra - food - activity);

  const seed = seedFrom(`${input.startDate}|${extra}|${profile.diet || ""}|${input.occasion || ""}`);
  const days: CompensationDay[] = cuts.map((cut, i) => ({
    date: addDays(input.startDate, i),
    calorie_target: usual - cut,
    adjustment: -cut,
    focus: focusFor(i, n),
    activity: activityFor(i, walkMin, extraSteps, usualSteps),
    meals: mealIdeas(profile, i, seed),
  }));

  const backTo = addDays(input.startDate, n);
  const avgTrim = Math.round(food / n / 10) * 10;
  return {
    extra_calories: extra,
    days,
    message: buildMessage({ occasion: input.occasion, name: input.name, n, avgTrim, walkMin, released, backTo, extra }),
    summary: {
      usual_calories: usual,
      floor_calories: floor,
      food_kcal: food,
      activity_kcal: activity,
      released_kcal: released,
      avg_daily_trim: avgTrim,
      walk_minutes_per_day: walkMin,
      extra_steps_per_day: extraSteps,
      back_to_usual: backTo,
    },
  };
}

/**
 * Estimate the surplus from a free-text description: parsed meal calories minus
 * a normal meal (~⅓ of the daily target). Defaults to 600 kcal when nothing is recognised.
 */
export function estimateExtraDetails(description: string | undefined, targets: Targets): { calories: number; matched: string[]; source: "parsed" | "default" } {
  const text = (description || "").trim();
  if (text) {
    try {
      const parsed = parseMealText(text);
      const total = parsed.items.reduce((s, i) => s + (Number(i.calories) || 0), 0);
      if (total > 0) {
        const normalMeal = Math.round((Number(targets?.calories) || 2000) / 3);
        const calories = Math.round(clamp(total - normalMeal, 150, 5000) / 10) * 10;
        return { calories, matched: parsed.items.map((i) => i.name), source: "parsed" };
      }
    } catch (e) {
      console.warn("[orza] compensation estimate failed", e);
    }
  }
  return { calories: DEFAULT_EXTRA_CALORIES, matched: [], source: "default" };
}

export function estimateExtraCalories(description: string | undefined, targets: Targets): number {
  return estimateExtraDetails(description, targets).calories;
}
