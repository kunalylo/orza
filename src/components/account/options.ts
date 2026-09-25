/**
 * Shared option lists, labels and limits for the account screens (credits, settings, admin).
 * Pure data — safe to import from API routes and client components alike.
 */
import type { CreditAction } from "@/lib/credits";
import type { ActivityLevel, Diet, HouseholdMode, Language, Preferences, Sex, Targets } from "@/lib/types";

/* ───────────────────────────── Profile enums ───────────────────────────── */

export const SEXES = ["female", "male", "other"] as const satisfies readonly Sex[];
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"] as const satisfies readonly ActivityLevel[];
export const DIETS = ["vegetarian", "eggetarian", "non_vegetarian", "vegan", "jain"] as const satisfies readonly Diet[];
export const LANGUAGES = ["en", "hi", "hinglish"] as const satisfies readonly Language[];
export const HOUSEHOLD_MODES = ["individual", "couple", "family", "caregiver"] as const satisfies readonly HouseholdMode[];
export const GOAL_TYPES = ["lose", "maintain", "gain"] as const;

export type Option<T extends string> = { value: T; label: string; hint?: string };

export const SEX_OPTIONS: Option<Sex>[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other / prefer not to say" },
];

export const ACTIVITY_OPTIONS: Option<ActivityLevel>[] = [
  { value: "sedentary", label: "Mostly sitting", hint: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", hint: "Walks, 1–3 workouts a week" },
  { value: "moderate", label: "Moderately active", hint: "3–5 workouts a week" },
  { value: "active", label: "Very active", hint: "6–7 workouts a week" },
  { value: "very_active", label: "Athlete / physical job", hint: "Hard training or manual work daily" },
];

export const DIET_OPTIONS: Option<Diet>[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_vegetarian", label: "Non-vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
];

export const LANGUAGE_OPTIONS: Option<Language>[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिंदी)" },
  { value: "hinglish", label: "Hinglish" },
];

export const HOUSEHOLD_OPTIONS: Option<HouseholdMode>[] = [
  { value: "individual", label: "Just me", hint: "Individual" },
  { value: "couple", label: "Me and my partner", hint: "Couple" },
  { value: "family", label: "My family", hint: "Family" },
  { value: "caregiver", label: "Someone I care for", hint: "Caregiver" },
];

/** Same values the onboarding flow stores, so chips line up with existing profiles. */
export const ALLERGY_SUGGESTIONS: Option<string>[] = [
  { value: "peanuts", label: "Peanuts" },
  { value: "tree nuts", label: "Tree nuts" },
  { value: "dairy", label: "Dairy / lactose" },
  { value: "gluten", label: "Gluten" },
  { value: "soy", label: "Soy" },
  { value: "eggs", label: "Eggs" },
  { value: "fish", label: "Fish" },
  { value: "shellfish", label: "Shellfish" },
  { value: "sesame", label: "Sesame" },
];

export const LIFESTYLE_SUGGESTIONS = ["Desk job", "Night shifts", "Travel often", "Fasting days", "Eat out a lot"];

export const GOAL_LABELS: Record<(typeof GOAL_TYPES)[number], string> = {
  lose: "Lose weight",
  maintain: "Maintain weight",
  gain: "Gain weight or muscle",
};

export const labelOf = <T extends string>(options: Option<T>[], value?: T | null) =>
  options.find((o) => o.value === value)?.label ?? "";

/** Server-side validation ranges for profile numbers (metric). */
export const PROFILE_LIMITS = {
  age: { min: 13, max: 100 },
  height_cm: { min: 100, max: 250 },
  weight_kg: { min: 25, max: 350 },
  allergies: { maxItems: 20, maxLength: 40 },
  conditions: { maxItems: 10, maxLength: 80 },
  region: { maxLength: 60 },
  lifestyle: { maxLength: 300 }, // same cap as the onboarding "routine" step
  name: { maxLength: 60 },
} as const;

/** Profile fields that change the recommended daily targets. */
export const TARGET_DRIVERS = ["age", "sex", "height_cm", "weight_kg", "activity_level", "goal"] as const;

/* ───────────────────────────── Targets ───────────────────────────── */

export type TargetKey = keyof Targets;

export const TARGET_FIELDS: { key: TargetKey; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "calories", label: "Calories", unit: "kcal", min: 1000, max: 6000, step: 10 },
  { key: "protein_g", label: "Protein", unit: "g", min: 20, max: 400, step: 1 },
  { key: "carbs_g", label: "Carbs", unit: "g", min: 20, max: 900, step: 1 },
  { key: "fat_g", label: "Fat", unit: "g", min: 10, max: 300, step: 1 },
  { key: "fiber_g", label: "Fiber", unit: "g", min: 5, max: 100, step: 1 },
  { key: "water_glasses", label: "Water", unit: "glasses", min: 1, max: 30, step: 1 },
  { key: "steps", label: "Steps", unit: "steps", min: 1000, max: 50000, step: 500 },
];

/* ───────────────────────────── Preferences ───────────────────────────── */

export const UNITS = ["metric", "imperial"] as const satisfies readonly Preferences["units"][];
export const TONES = ["gentle", "direct"] as const satisfies readonly Preferences["tone"][];

export const DEFAULT_PREFERENCES: Preferences = {
  units: "metric",
  reminders: true,
  weekly_report: true,
  tone: "gentle",
  ai_training_opt_out: false,
};

/* ───────────────────────────── Credit requests ───────────────────────────── */

/** Longest note a member can add to a "Request more credits" message. */
export const CREDIT_REQUEST_MESSAGE_MAX = 800;

/* ───────────────────────────── Memory ───────────────────────────── */

export const MEMORY_MAX_ITEMS = 30;
export const MEMORY_MAX_LENGTH = 200;

/* ───────────────────────────── Credits ───────────────────────────── */

/** Rows of the "What costs credits" table, in display order. */
export const CREDIT_ACTION_ROWS: { key: CreditAction; label: string; hint: string }[] = [
  { key: "scan", label: "Scan a meal photo", hint: "Snap & Know identifies every item on your plate" },
  { key: "meal_text", label: "Log a meal with AI", hint: "Type or speak it — English, Hindi or Hinglish" },
  { key: "chat", label: "Chat message", hint: "Ask ÖRZA anything about food and habits" },
  { key: "recipe", label: "Generate a recipe", hint: "Personalised to your diet and targets" },
  { key: "compensation", label: "Rebalance plan", hint: "A kind plan after a special meal" },
];

const ACTION_LABELS: Record<string, string> = {
  scan: "Meal photo scan",
  meal_text: "AI meal log",
  chat: "Chat message",
  recipe: "Recipe generated",
  compensation: "Rebalance plan",
  report_insight: "Report insight",
};

/** Friendly label for a stored transaction reason ("chat", "Refund: scan", "Welcome credits" …). */
export function transactionLabel(reason: string): string {
  const r = (reason || "").trim();
  if (!r) return "Credit update";
  const refund = r.match(/^refund:\s*(.+)$/i);
  if (refund) return `Refund · ${ACTION_LABELS[refund[1].trim()] ?? refund[1].trim()}`;
  return ACTION_LABELS[r] ?? r;
}

/** The credit action a transaction reason refers to, when recognisable. */
export function transactionAction(reason: string): CreditAction | null {
  const r = (reason || "").replace(/^refund:\s*/i, "").trim().toLowerCase();
  if (r in ACTION_LABELS) return r as CreditAction;
  if (r.startsWith("rebalance")) return "compensation";
  if (r.includes("scan") || r.includes("photo")) return "scan";
  if (r.includes("recipe")) return "recipe";
  if (r.includes("chat")) return "chat";
  if (r.includes("meal")) return "meal_text";
  return null;
}

/** Admin credit adjustments. */
export const ADJUST_LIMIT = 10000;
export const ADJUST_REASON = { min: 3, max: 120 } as const;
