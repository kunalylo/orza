/**
 * Onboarding step machine — pure and deterministic (no DB, no AI).
 *
 * The conversation is scripted: each step has a question (`promptFor`), a parser/validator
 * (`applyAnswer`) that turns free text, chip values or numbers into typed answers, and a
 * short acknowledgement in ÖRZA's voice (`ackFor`). The API routes persist
 * `{ step, answers }` in the `onboarding` collection and call into this module.
 */
import { healthyFloorKg, planGoal } from "@/components/goals/goal-math";
import { capMemory } from "@/lib/allergens";
import { computeTargets } from "@/lib/domain/targets";
import type { ActivityLevel, Diet, GoalType, HouseholdMode, Language, Profile, Sex, Targets } from "@/lib/types";
import { formatNumber, round } from "@/lib/utils";

/* ───────────────────────────── Types ───────────────────────────── */

export const STEPS = [
  "goal",
  "sex",
  "age",
  "height",
  "weight",
  "target_weight",
  "activity",
  "diet",
  "allergies",
  "region",
  "language",
  "household",
  "lifestyle",
  "summary",
] as const;

export type QuestionStep = (typeof STEPS)[number];
export type StepId = QuestionStep | "complete";

/** Short names for each step (progress lists, "your answers so far"). */
export const STEP_LABELS: Record<QuestionStep, string> = {
  goal: "Goal",
  sex: "About you",
  age: "Age",
  height: "Height",
  weight: "Weight",
  target_weight: "Target weight",
  activity: "Activity",
  diet: "Diet",
  allergies: "Allergies",
  region: "Region",
  language: "Language",
  household: "Household",
  lifestyle: "Routine",
  summary: "Your plan",
};
export type InputKind = "text" | "number" | "choice" | "multi" | "none";
export type GoalFocus = "lose" | "maintain" | "gain" | "track" | "healthier";

export interface OnboardingAnswers {
  goal?: GoalType;
  goal_focus?: GoalFocus;
  sex?: Sex;
  age?: number;
  height_cm?: number;
  height_unit?: "cm" | "ft";
  weight_kg?: number;
  weight_unit?: "kg" | "lb";
  /** null = the user skipped choosing a target. */
  target_weight_kg?: number | null;
  activity_level?: ActivityLevel;
  diet?: Diet;
  allergies?: string[];
  region?: string;
  language?: Language;
  household_mode?: HouseholdMode;
  /** null = skipped. */
  lifestyle?: string | null;
}

/** Stored in col("onboarding"), one per user. */
export interface OnboardingState {
  id: string;
  user_id: string;
  step: StepId;
  answers: OnboardingAnswers;
  updated_at: string;
}

export interface StepOption {
  value: string;
  label: string;
  hint?: string;
}

export interface PlanSummary {
  targets: Pick<Targets, "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "water_glasses" | "steps">;
  bmr: number | null;
  tdee: number | null;
  goal: GoalType;
  goal_line: string;
  facts: { label: string; value: string }[];
}

export interface StepPrompt {
  step: StepId;
  /** ÖRZA's message: acknowledgement of the previous answer (if any) + the question. Paragraphs split by blank lines. */
  message: string;
  /** The acknowledgement part of `message` on its own (lets the UI render the summary step as a card). */
  ack?: string;
  input: InputKind;
  options?: StepOption[];
  /** For long option lists (region): values to show before the user searches. */
  featured?: string[];
  placeholder?: string;
  /** Unit choices for number steps; the first is the default. */
  units?: string[];
  unit_hint?: string;
  min?: number;
  max?: number;
  optional?: boolean;
  /** multi: values that clear every other selection (e.g. "none"). */
  exclusive?: string[];
  /** multi/text: user may type their own value. */
  allow_custom?: boolean;
  summary?: PlanSummary;
}

export interface ChatLine {
  role: "assistant" | "user";
  content: string;
}

export type ApplyResult = { ok: true; answers: OnboardingAnswers } | { ok: false; error: string };

/* ───────────────────────────── Option lists ───────────────────────────── */

const GOAL_OPTIONS: StepOption[] = [
  { value: "lose", label: "Lose weight" },
  { value: "maintain", label: "Maintain my weight" },
  { value: "gain", label: "Gain weight or muscle" },
  { value: "healthier", label: "Eat healthier" },
  { value: "track", label: "Just track what I eat" },
];

const SEX_OPTIONS: StepOption[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other / prefer not to say" },
];

const ACTIVITY_OPTIONS: StepOption[] = [
  { value: "sedentary", label: "Mostly sitting", hint: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", hint: "Walks, 1–3 workouts a week" },
  { value: "moderate", label: "Moderately active", hint: "3–5 workouts a week" },
  { value: "active", label: "Very active", hint: "6–7 workouts a week" },
  { value: "very_active", label: "Athlete / physical job", hint: "Hard training or manual work daily" },
];

const DIET_OPTIONS: StepOption[] = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "eggetarian", label: "Eggetarian" },
  { value: "non_vegetarian", label: "Non-vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "jain", label: "Jain" },
];

const ALLERGY_OPTIONS: StepOption[] = [
  { value: "none", label: "None" },
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

const LANGUAGE_OPTIONS: StepOption[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (हिंदी)" },
  { value: "hinglish", label: "Hinglish" },
];

const HOUSEHOLD_OPTIONS: StepOption[] = [
  { value: "individual", label: "Just me" },
  { value: "couple", label: "Me and my partner" },
  { value: "family", label: "My family" },
  { value: "caregiver", label: "Someone I care for" },
];

const LIFESTYLE_SUGGESTIONS: StepOption[] = [
  { value: "Desk job", label: "Desk job" },
  { value: "Night shifts", label: "Night shifts" },
  { value: "Travel often", label: "Travel often" },
  { value: "Fasting days", label: "Fasting days" },
  { value: "Eat out a lot", label: "Eat out a lot" },
];

const SUMMARY_OPTIONS: StepOption[] = [
  { value: "confirm", label: "Looks good — let's go" },
  { value: "restart", label: "Start over" },
];

export const OUTSIDE_INDIA = "Outside India";

export const INDIAN_REGIONS = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

const FEATURED_REGIONS = [
  "Maharashtra",
  "Delhi",
  "Karnataka",
  "Tamil Nadu",
  "Uttar Pradesh",
  "Gujarat",
  "West Bengal",
  "Telangana",
  "Punjab",
  "Kerala",
  OUTSIDE_INDIA,
];

// Cities, old names and common abbreviations → state / UT.
const REGION_ALIASES: Record<string, string> = {
  mumbai: "Maharashtra", bombay: "Maharashtra", pune: "Maharashtra", nagpur: "Maharashtra", nashik: "Maharashtra", thane: "Maharashtra",
  bangalore: "Karnataka", bengaluru: "Karnataka", mysore: "Karnataka", mysuru: "Karnataka", mangalore: "Karnataka",
  chennai: "Tamil Nadu", madras: "Tamil Nadu", coimbatore: "Tamil Nadu", madurai: "Tamil Nadu", tn: "Tamil Nadu",
  kolkata: "West Bengal", calcutta: "West Bengal", wb: "West Bengal", bengal: "West Bengal",
  hyderabad: "Telangana", secunderabad: "Telangana", warangal: "Telangana",
  "new delhi": "Delhi", ncr: "Delhi", dilli: "Delhi", "delhi ncr": "Delhi",
  gurgaon: "Haryana", gurugram: "Haryana", faridabad: "Haryana",
  noida: "Uttar Pradesh", lucknow: "Uttar Pradesh", kanpur: "Uttar Pradesh", varanasi: "Uttar Pradesh", ghaziabad: "Uttar Pradesh", agra: "Uttar Pradesh", up: "Uttar Pradesh",
  ahmedabad: "Gujarat", surat: "Gujarat", vadodara: "Gujarat", baroda: "Gujarat", rajkot: "Gujarat",
  jaipur: "Rajasthan", udaipur: "Rajasthan", jodhpur: "Rajasthan",
  kochi: "Kerala", cochin: "Kerala", trivandrum: "Kerala", thiruvananthapuram: "Kerala", kozhikode: "Kerala", calicut: "Kerala",
  bhopal: "Madhya Pradesh", indore: "Madhya Pradesh", mp: "Madhya Pradesh",
  patna: "Bihar", ranchi: "Jharkhand", bhubaneswar: "Odisha", orissa: "Odisha", guwahati: "Assam",
  dehradun: "Uttarakhand", shimla: "Himachal Pradesh", hp: "Himachal Pradesh",
  srinagar: "Jammu and Kashmir", jammu: "Jammu and Kashmir", kashmir: "Jammu and Kashmir", jk: "Jammu and Kashmir",
  amritsar: "Punjab", ludhiana: "Punjab", jalandhar: "Punjab",
  pondicherry: "Puducherry", pondy: "Puducherry",
  vizag: "Andhra Pradesh", visakhapatnam: "Andhra Pradesh", vijayawada: "Andhra Pradesh", ap: "Andhra Pradesh",
  raipur: "Chhattisgarh", panaji: "Goa", leh: "Ladakh", shillong: "Meghalaya", imphal: "Manipur", gangtok: "Sikkim", agartala: "Tripura",
  andaman: "Andaman and Nicobar Islands", daman: "Dadra and Nagar Haveli and Daman and Diu", diu: "Dadra and Nagar Haveli and Daman and Diu",
  abroad: OUTSIDE_INDIA, outside: OUTSIDE_INDIA, overseas: OUTSIDE_INDIA, nri: OUTSIDE_INDIA, "not in india": OUTSIDE_INDIA,
  usa: OUTSIDE_INDIA, us: OUTSIDE_INDIA, america: OUTSIDE_INDIA, uk: OUTSIDE_INDIA, london: OUTSIDE_INDIA, canada: OUTSIDE_INDIA,
  uae: OUTSIDE_INDIA, dubai: OUTSIDE_INDIA, singapore: OUTSIDE_INDIA, australia: OUTSIDE_INDIA, germany: OUTSIDE_INDIA,
};

/* ───────────────────────────── Parsing helpers ───────────────────────────── */

type Raw = string | number | string[] | null | undefined;

const DEVANAGARI_DIGITS = /[०-९]/g;

/** Lowercase, Devanagari digits → ASCII, curly quotes/primes → ASCII. */
function norm(raw: Raw): string {
  const s = Array.isArray(raw) ? raw.join(", ") : raw == null ? "" : String(raw);
  return s
    .replace(DEVANAGARI_DIGITS, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[’′‘`´]/g, "'")
    .replace(/[”″“]/g, '"')
    .trim()
    .toLowerCase();
}

const words = (s: string) => s.replace(/[^a-z0-9ऀ-ॿ\s]/g, " ").replace(/\s+/g, " ").trim();

function firstNumber(s: string): number | null {
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export const SKIP_WORDS = /^(skip|skip for now|no|nope|none|nothing|na|n\/a|not sure|not sure yet|pass|later|nahi|nahin|kuch nahi)$/;

function isSkip(raw: Raw) {
  return SKIP_WORDS.test(words(norm(raw)));
}

/** Match a raw answer against option values/labels, then keyword rules (first rule that matches wins). */
function pick<T extends string>(raw: Raw, options: StepOption[], rules: [RegExp, T][]): T | null {
  const s = norm(raw);
  if (!s) return null;
  const w = words(s);
  const hit = options.find((o) => o.value.toLowerCase() === s || words(o.label.toLowerCase()) === w);
  if (hit) return hit.value as T;
  for (const [re, v] of rules) if (re.test(w)) return v;
  return null;
}

export function formatKg(kg: number) {
  return `${round(kg, 1)} kg`;
}

/** Weight in the unit the user answered in (pounds also show kg). */
export function formatWeight(kg: number, unit: "kg" | "lb" = "kg") {
  return unit === "lb" ? `${Math.round(kg / 0.45359237)} lb (${formatKg(kg)})` : formatKg(kg);
}

export function cmToFtIn(cm: number) {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}

export function formatHeight(cm: number, unit: "cm" | "ft" = "cm") {
  const { ft, inch } = cmToFtIn(cm);
  const imperial = `${ft}′${inch}″`;
  return unit === "ft" ? `${imperial} (${Math.round(cm)} cm)` : `${Math.round(cm)} cm (${imperial})`;
}

/**
 * Height from free text: "172 cm", "1.72 m", "5'8\"", "5 ft 8 in", "5 feet 8", "68 in",
 * bare "172" (cm), bare "5.8" / "5.11" (feet.inches, as commonly said in India), bare "1.72" (m).
 */
export function parseHeight(raw: Raw): { cm: number; unit: "cm" | "ft" } | null {
  const s = norm(raw).replace(/,/g, ".");
  if (!s) return null;
  let m: RegExpMatchArray | null;

  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:cm|cms|centimet(?:er|re)s?)\b/))) return { cm: Number(m[1]), unit: "cm" };
  if ((m = s.match(/(\d(?:\.\d+)?)\s*(?:m|mtrs?|met(?:er|re)s?)\b/))) return { cm: Number(m[1]) * 100, unit: "cm" };
  // "5.6 ft" — as commonly said in India this means 5 ft 6 in, not 5.6 feet.
  if ((m = s.match(/^(\d)\.(\d{1,2})\s*(?:'|ft|feet|foot)$/))) {
    const inch = Number(m[2]);
    if (inch >= 12) return null;
    return { cm: (Number(m[1]) * 12 + inch) * 2.54, unit: "ft" };
  }
  if ((m = s.match(/(\d{1,2})\s*(?:'|ft|feet|foot)\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:"|''|in|inch|inches)?)?/))) {
    const ft = Number(m[1]);
    const inch = m[2] ? Number(m[2]) : 0;
    if (inch >= 12) return null;
    return { cm: (ft * 12 + inch) * 2.54, unit: "ft" };
  }
  if ((m = s.match(/^(\d{2,3}(?:\.\d+)?)\s*(?:"|in|inch|inches)$/))) return { cm: Number(m[1]) * 2.54, unit: "ft" };

  // Bare number — decide by magnitude.
  if ((m = s.match(/^(\d+)(?:\.(\d+))?$/))) {
    const whole = Number(m[1]);
    const frac = m[2];
    const n = Number(frac ? `${whole}.${frac}` : whole);
    if (n >= 90 && n <= 260) return { cm: n, unit: "cm" };
    if (n >= 1 && n < 2.6 && frac) return { cm: n * 100, unit: "cm" };
    if (whole >= 3 && whole <= 7) {
      const inch = frac ? Number(frac) : 0;
      if (inch >= 12) return null;
      return { cm: (whole * 12 + inch) * 2.54, unit: "ft" };
    }
  }
  return null;
}

/** Weight from free text: "70kg", "70 kgs", "154 lb", "154 pounds", bare "70" (uses `defaultUnit`). */
export function parseWeight(raw: Raw, defaultUnit: "kg" | "lb" = "kg"): { kg: number; unit: "kg" | "lb" } | null {
  const s = norm(raw).replace(/,/g, ".");
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs|kilo|kilos|kilograms?)\b/))) return { kg: Number(m[1]), unit: "kg" };
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/))) return { kg: Number(m[1]) * 0.45359237, unit: "lb" };
  const n = firstNumber(s);
  if (n == null || !/^\D*\d+(?:\.\d+)?\D*$/.test(s)) return null;
  return defaultUnit === "lb" ? { kg: n * 0.45359237, unit: "lb" } : { kg: n, unit: "kg" };
}

export function parseAge(raw: Raw): number | null {
  const s = norm(raw);
  if (!s) return null;
  const n = firstNumber(s);
  return n == null ? null : Math.floor(n);
}

export function parseRegion(raw: Raw): string | null {
  const s = words(norm(raw));
  if (!s) return null;
  if (s === words(OUTSIDE_INDIA.toLowerCase())) return OUTSIDE_INDIA;
  const byLength = [...INDIAN_REGIONS].sort((a, b) => b.length - a.length);
  const exact = byLength.find((r) => words(r.toLowerCase()) === s);
  if (exact) return exact;
  if (REGION_ALIASES[s]) return REGION_ALIASES[s];
  // "I live in Kerala", "from pune"
  const contained = byLength.find((r) => new RegExp(`\\b${words(r.toLowerCase())}\\b`).test(s));
  if (contained) return contained;
  const alias = Object.keys(REGION_ALIASES)
    .sort((a, b) => b.length - a.length)
    .find((k) => k.length > 2 && new RegExp(`\\b${k}\\b`).test(s));
  if (alias) return REGION_ALIASES[alias];
  // Unique prefix: "tamil", "andhra", "himachal"
  if (s.length >= 3) {
    const pre = INDIAN_REGIONS.filter((r) => r.toLowerCase().startsWith(s));
    if (pre.length === 1) return pre[0];
  }
  return null;
}

function parseAllergies(raw: Raw): string[] | "none" | null {
  const parts = (Array.isArray(raw) ? raw : norm(raw).split(/,|;|\/|\band\b|\n/))
    .map((p) => norm(p).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const known = new Map(ALLERGY_OPTIONS.map((o) => [o.value, [o.value]]));
  // Plain "nuts" usually means peanuts as well as tree nuts (peanuts are legumes), so it keeps both.
  const synonyms: Record<string, string[]> = {
    peanut: ["peanuts"], groundnut: ["peanuts"], groundnuts: ["peanuts"], moongphali: ["peanuts"],
    nut: ["tree nuts", "peanuts"], nuts: ["tree nuts", "peanuts"], "all nuts": ["tree nuts", "peanuts"],
    "tree nut": ["tree nuts"], almond: ["tree nuts"], almonds: ["tree nuts"], cashew: ["tree nuts"], cashews: ["tree nuts"],
    walnut: ["tree nuts"], walnuts: ["tree nuts"],
    milk: ["dairy"], lactose: ["dairy"], "dairy / lactose": ["dairy"], paneer: ["dairy"],
    wheat: ["gluten"], egg: ["eggs"], prawns: ["shellfish"], prawn: ["shellfish"], shrimp: ["shellfish"], crab: ["shellfish"],
    soya: ["soy"], til: ["sesame"],
  };
  const out: string[] = [];
  for (const p of parts) {
    if (SKIP_WORDS.test(words(p)) || p === "none") continue;
    // "allergic to nuts", "nut allergy", "peanut allergies" → the food itself
    const food = p.replace(/^(?:i am |i'm |im )?allergic to\s+/, "").replace(/\s+(?:allerg(?:y|ies)|intolerance)$/, "").trim();
    if (!food) continue;
    for (const v of known.get(food) || synonyms[food] || [food.slice(0, 40)]) if (!out.includes(v)) out.push(v);
  }
  if (!out.length) return "none";
  return out.slice(0, 12);
}

/* ───────────────────────────── Flow ───────────────────────────── */

const needsTarget = (a: OnboardingAnswers) => a.goal === "lose" || a.goal === "gain";

/**
 * Already at (or under) the lowest healthy weight for their height (BMI 18.5), so no loss target would be
 * safe — the Goals calculator refuses every one. ÖRZA plans balanced targets instead of a deficit.
 */
function isUnderweight(a: OnboardingAnswers): boolean {
  return !!a.weight_kg && !!a.height_cm && a.weight_kg <= healthyFloorKg(a.height_cm);
}

/** The user asked to lose weight but is already under a healthy BMI, so the plan is balanced instead. */
const lossHeldForBmi = (a: OnboardingAnswers) => a.goal_focus === "lose" && a.goal !== "lose" && isUnderweight(a);

/** The ordered steps this user will see (target weight only for lose/gain). */
export function sequenceFor(answers: OnboardingAnswers): QuestionStep[] {
  return STEPS.filter((s) => s !== "target_weight" || answers.goal === undefined || needsTarget(answers));
}

export function nextStep(step: StepId, answers: OnboardingAnswers): StepId {
  if (step === "complete") return "complete";
  const seq = sequenceFor(answers);
  const i = seq.indexOf(step as QuestionStep);
  return i < 0 || i >= seq.length - 1 ? "complete" : seq[i + 1];
}

export function progressOf(step: StepId, answers: OnboardingAnswers) {
  const seq = sequenceFor(answers);
  const total = seq.length;
  if (step === "complete") return { index: total, total, value: 1 };
  const index = Math.max(0, seq.indexOf(step as QuestionStep));
  return { index, total, value: round(index / total, 3) };
}

export const isQuestionStep = (s: unknown): s is QuestionStep => typeof s === "string" && (STEPS as readonly string[]).includes(s);

/* ───────────────────────────── Copy ───────────────────────────── */

const firstName = (name?: string) => (name || "").trim().split(/\s+/)[0] || "there";
const labelOf = (opts: StepOption[], v?: string | null) => opts.find((o) => o.value === v)?.label ?? v ?? "";
const join = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join("\n\n");

function question(step: QuestionStep, a: OnboardingAnswers, name: string, intro: boolean): string {
  switch (step) {
    case "goal":
      return intro
        ? join(
            `Hi ${firstName(name)}, I'm ÖRZA — lovely to meet you. I'll keep this quick, and there are no wrong answers.`,
            "First, what brings you here?"
          )
        : "What brings you to ÖRZA?";
    case "sex":
      return "Which best describes you? It helps me estimate your energy needs.";
    case "age":
      return "How old are you?";
    case "height":
      return "How tall are you? Centimetres or feet and inches both work.";
    case "weight":
      return "What's your current weight?";
    case "target_weight":
      return `What weight would you like to reach? You're at ${formatWeight(a.weight_kg ?? 0, a.weight_unit)} now.`;
    case "activity":
      return "How active is a typical week for you?";
    case "diet":
      return "How do you eat?";
    case "allergies":
      return "Any food allergies or foods you avoid? Pick all that apply, or add your own.";
    case "region":
      return "Which state do you live in? I'll lean on dishes you actually eat.";
    case "language":
      return "Which language would you like to chat in? You can mix freely either way.";
    case "household":
      return "Who are you tracking for?";
    case "lifestyle":
      return "Anything about your routine I should know — night shifts, a desk job, lots of travel, fasting days? This one's optional.";
    case "summary":
      return summaryText(a, name);
  }
}

/** Short acknowledgement of a stored answer, in ÖRZA's warm, judgment-free voice. */
export function ackFor(step: QuestionStep, a: OnboardingAnswers): string {
  switch (step) {
    case "goal":
      return {
        lose: "Great — we'll aim for steady, sustainable progress. No crash diets.",
        maintain: "Lovely — keeping things balanced is a great goal.",
        gain: "Got it — we'll fuel you well so you build up steadily.",
        track: "Perfect — simple, honest tracking with zero pressure.",
        healthier: "Love that — small, better choices add up fast.",
      }[a.goal_focus || a.goal || "maintain"];
    case "sex":
      return "Thanks — that helps me get your numbers right.";
    case "age":
      return `${a.age} — noted.`;
    case "height":
      return `${formatHeight(a.height_cm ?? 0, a.height_unit)} — got it.`;
    case "weight":
      return join(
        `${formatWeight(a.weight_kg ?? 0, a.weight_unit)} — thanks. This stays private to you.`,
        lossHeldForBmi(a) &&
          `You're already at the lower end of the healthy range for your height, so I won't plan a calorie deficit. I'll set balanced targets to keep you well nourished instead — and if you'd still like to lose weight, please check with your doctor first.`
      );
    case "target_weight": {
      if (a.target_weight_kg == null) return "No problem — we can set a target later from Goals.";
      const diff = Math.abs((a.weight_kg ?? 0) - a.target_weight_kg);
      return `${formatWeight(a.target_weight_kg, a.weight_unit)} it is — that's ${formatWeight(diff, a.weight_unit)} to ${a.goal === "gain" ? "gain" : "go"}, at a gentle pace.`;
    }
    case "activity":
      return `${labelOf(ACTIVITY_OPTIONS, a.activity_level)} — noted.`;
    case "diet":
      return {
        vegetarian: "Vegetarian — I'll keep every suggestion meat-free.",
        eggetarian: "Eggetarian — veg plus eggs, noted.",
        non_vegetarian: "Non-vegetarian — noted, I'll mix things up.",
        vegan: "Vegan — I'll keep suggestions fully plant-based.",
        jain: "Jain — I'll keep suggestions Jain-friendly.",
      }[a.diet || "vegetarian"];
    case "allergies":
      return a.allergies?.length ? `I'll steer clear of ${listText(a.allergies.map((x) => labelOf(ALLERGY_OPTIONS, x).toLowerCase()))}.` : "No allergies — noted.";
    case "region":
      return a.region === OUTSIDE_INDIA
        ? "Noted — I'll keep Indian favourites handy wherever you are."
        : `${a.region} — expect familiar dishes in my suggestions.`;
    case "language":
      return { en: "English it is.", hi: "हिंदी — बढ़िया!", hinglish: "Hinglish — perfect, bilkul!" }[a.language || "en"];
    case "household":
      return {
        individual: "Just you — this space is all yours.",
        couple: "The two of you — lovely.",
        family: "The whole family — wonderful.",
        caregiver: "Caring for someone matters. I'm here to help.",
      }[a.household_mode || "individual"];
    case "lifestyle":
      return a.lifestyle ? "Thanks — I'll keep that in mind." : "No problem.";
    case "summary":
      return "";
  }
}

/** How the user's answer reads back in the chat transcript. */
export function answerLabel(step: QuestionStep, a: OnboardingAnswers): string {
  switch (step) {
    case "goal":
      return labelOf(GOAL_OPTIONS, a.goal_focus || a.goal);
    case "sex":
      return labelOf(SEX_OPTIONS, a.sex);
    case "age":
      return `${a.age}`;
    case "height": {
      if (!a.height_cm) return "";
      const { ft, inch } = cmToFtIn(a.height_cm);
      return a.height_unit === "ft" ? `${ft} ft ${inch} in` : `${Math.round(a.height_cm)} cm`;
    }
    case "weight":
      return a.weight_unit === "lb" ? `${Math.round((a.weight_kg ?? 0) / 0.45359237)} lb` : formatKg(a.weight_kg ?? 0);
    case "target_weight":
      if (a.target_weight_kg == null) return "Not sure yet";
      return a.weight_unit === "lb" ? `${Math.round(a.target_weight_kg / 0.45359237)} lb` : formatKg(a.target_weight_kg);
    case "activity":
      return labelOf(ACTIVITY_OPTIONS, a.activity_level);
    case "diet":
      return labelOf(DIET_OPTIONS, a.diet);
    case "allergies":
      return a.allergies?.length ? a.allergies.map((x) => labelOf(ALLERGY_OPTIONS, x)).join(", ") : "None";
    case "region":
      return a.region || "";
    case "language":
      return labelOf(LANGUAGE_OPTIONS, a.language);
    case "household":
      return labelOf(HOUSEHOLD_OPTIONS, a.household_mode);
    case "lifestyle":
      return a.lifestyle || "Skip";
    case "summary":
      return "";
  }
}

function listText(xs: string[]) {
  if (xs.length <= 1) return xs[0] || "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/* ───────────────────────────── Prompts ───────────────────────────── */

/** The question for `step` (optionally prefixed with an acknowledgement) plus how the UI should collect the answer. */
export function promptFor(step: StepId, answers: OnboardingAnswers, opts: { name: string; ack?: string; intro?: boolean }): StepPrompt {
  const ack = opts.ack || undefined;
  if (step === "complete") {
    return { step, message: join(ack, `You're all set, ${firstName(opts.name)}.`), ack, input: "none" };
  }
  const intro = opts.intro ?? (step === "goal" && !answers.goal);
  const message = join(ack, question(step, answers, opts.name, intro));
  const base = { step, message, ack };
  switch (step) {
    case "goal":
      return { ...base, input: "choice", options: GOAL_OPTIONS, allow_custom: true, placeholder: "Or tell me in your own words" };
    case "sex":
      return { ...base, input: "choice", options: SEX_OPTIONS };
    case "age":
      return { ...base, input: "number", unit_hint: "years", min: 13, max: 100, placeholder: "e.g. 32" };
    case "height":
      return { ...base, input: "number", units: ["cm", "ft"], min: 100, max: 250, placeholder: "e.g. 165 cm or 5'6\"" };
    case "weight":
      return { ...base, input: "number", units: ["kg", "lb"], min: 25, max: 300, placeholder: "e.g. 68 kg or 150 lb" };
    case "target_weight":
      return {
        ...base,
        input: "number",
        units: answers.weight_unit === "lb" ? ["lb", "kg"] : ["kg", "lb"],
        min: 25,
        max: 300,
        optional: true,
        options: [{ value: "skip", label: "Not sure yet" }],
        placeholder: answers.goal === "gain" ? "e.g. 72 kg" : "e.g. 62 kg",
      };
    case "activity":
      return { ...base, input: "choice", options: ACTIVITY_OPTIONS };
    case "diet":
      return { ...base, input: "choice", options: DIET_OPTIONS };
    case "allergies":
      return { ...base, input: "multi", options: ALLERGY_OPTIONS, exclusive: ["none"], allow_custom: true, placeholder: "Add another, e.g. mushrooms" };
    case "region":
      return {
        ...base,
        input: "choice",
        options: [...INDIAN_REGIONS.map((r) => ({ value: r, label: r })), { value: OUTSIDE_INDIA, label: OUTSIDE_INDIA }],
        featured: FEATURED_REGIONS,
        allow_custom: true,
        placeholder: "Search your state or city",
      };
    case "language":
      return { ...base, input: "choice", options: LANGUAGE_OPTIONS };
    case "household":
      return { ...base, input: "choice", options: HOUSEHOLD_OPTIONS };
    case "lifestyle":
      return {
        ...base,
        input: "text",
        options: LIFESTYLE_SUGGESTIONS,
        optional: true,
        allow_custom: true,
        placeholder: "e.g. Desk job, gym 3× a week, late dinners",
      };
    case "summary":
      return { ...base, input: "choice", options: SUMMARY_OPTIONS, summary: planSummary(answers) };
  }
}

/* ───────────────────────────── Answers ───────────────────────────── */

const err = (error: string): ApplyResult => ({ ok: false, error });

/** Validate and store the answer for `step`. Never mutates `prev`. */
export function applyAnswer(step: QuestionStep, raw: Raw, prev: OnboardingAnswers): ApplyResult {
  const a: OnboardingAnswers = { ...prev };
  switch (step) {
    case "goal": {
      const focus = pick<GoalFocus>(raw, GOAL_OPTIONS, [
        [/\b(lose|loose|loss|losing|kam|reduce|slim|cut|fat loss|weight down)\b/, "lose"],
        [/\b(gain|bulk|muscle|badh|badhana|increase|put on|bulking|strong)\b/, "gain"],
        [/\b(maintain|same|stay|steady|balance)\b/, "maintain"],
        [/\b(track|log|logging|monitor|count)\b/, "track"],
        [/\b(health|healthy|healthier|better|clean|nutrition|diet)\b/, "healthier"],
      ]);
      if (!focus) return err("I didn't quite catch that. Are you looking to lose, maintain or gain weight — or just eat healthier?");
      a.goal_focus = focus;
      a.goal = focus === "track" || focus === "healthier" ? "maintain" : focus;
      if (a.goal === "lose" && isUnderweight(a)) a.goal = "maintain";
      if (!needsTarget(a)) delete a.target_weight_kg;
      return { ok: true, answers: a };
    }
    case "sex": {
      const sex = pick<Sex>(raw, SEX_OPTIONS, [
        [/\b(f|female|woman|women|girl|lady|mahila|aurat)\b/, "female"],
        [/\b(m|male|man|men|boy|guy|purush|aadmi)\b/, "male"],
        [/\b(other|prefer|rather|non ?binary|skip|none)\b/, "other"],
      ]);
      if (!sex) return err("Please pick Female, Male, or Other / prefer not to say.");
      a.sex = sex;
      return { ok: true, answers: a };
    }
    case "age": {
      const age = parseAge(raw);
      if (age == null) return err("Just the number works — for example 32.");
      if (age < 13) return err("ÖRZA is designed for people aged 13 and over. If you mistyped, please enter your age again.");
      if (age > 100) return err("Please enter an age between 13 and 100.");
      a.age = age;
      return { ok: true, answers: a };
    }
    case "height": {
      const h = parseHeight(raw);
      if (!h) return err("I couldn't read that height. Try something like 165 cm or 5'6\".");
      if (h.cm < 100 || h.cm > 250) return err("That height looks a little off — please enter it between 100 and 250 cm (3′3″–8′2″).");
      a.height_cm = round(h.cm, 1);
      a.height_unit = h.unit;
      return { ok: true, answers: a };
    }
    case "weight": {
      const w = parseWeight(raw);
      if (!w) return err("I couldn't read that weight. Try something like 68 kg or 150 lb.");
      if (w.kg < 25 || w.kg > 300) return err("Please enter a weight between 25 and 300 kg (55–660 lb).");
      a.weight_kg = round(w.kg, 1);
      a.weight_unit = w.unit;
      if (a.goal_focus === "lose") {
        // Already under a healthy BMI: no deficit, whatever target they'd pick — plan balanced targets instead
        // (the ack explains why). Otherwise make sure an earlier redirect doesn't stick after a corrected weight.
        a.goal = isUnderweight(a) ? "maintain" : "lose";
        if (a.goal === "maintain") delete a.target_weight_kg;
      }
      return { ok: true, answers: a };
    }
    case "target_weight": {
      if (isSkip(raw)) {
        a.target_weight_kg = null;
        return { ok: true, answers: a };
      }
      const w = parseWeight(raw, a.weight_unit || "kg");
      if (!w) return err("I couldn't read that. Try a number like 62 kg — or tap “Not sure yet”.");
      if (w.kg < 25 || w.kg > 300) return err("Please enter a target between 25 and 300 kg.");
      const target = round(w.kg, 1);
      const current = a.weight_kg ?? 0;
      if (a.goal === "lose" && target >= current)
        return err(`For a weight-loss goal, your target should be below your current ${formatKg(current)}. Want to try another number?`);
      if (a.goal === "gain" && target <= current)
        return err(`For a gain goal, your target should be above your current ${formatKg(current)}. Want to try another number?`);
      // Same floor as the Goals calculator: never plan a loss below a healthy BMI (18.5).
      if (a.goal === "lose" && a.height_cm) {
        const floor = healthyFloorKg(a.height_cm);
        if (target < floor)
          return err(
            `That target sits below the healthy range for your height. Try ${formatWeight(floor, a.weight_unit)} or above — or check with your doctor first.`
          );
      }
      a.target_weight_kg = target;
      return { ok: true, answers: a };
    }
    case "activity": {
      const v = pick<ActivityLevel>(raw, ACTIVITY_OPTIONS, [
        // Specific phrases first; the generic "active" last so "lightly active" isn't misread.
        [/\b(athlete|physical job|manual|labou?r|twice a day|intense)\b/, "very_active"],
        [/\b(sedentary|sitting|sit|desk|inactive|no exercise|not active|lazy|none)\b/, "sedentary"],
        [/\b(light|lightly|walk|walks|1 3|sometimes)\b/, "light"],
        [/\b(moderate|moderately|3 5|gym|regular)\b/, "moderate"],
        [/\b(6|7|6 7|daily workout|every day|everyday|active)\b/, "active"],
      ]);
      if (!v) return err("Pick whichever feels closest — it doesn't need to be exact.");
      a.activity_level = v;
      return { ok: true, answers: a };
    }
    case "diet": {
      const v = pick<Diet>(raw, DIET_OPTIONS, [
        [/\b(non ?veg|nonveg|non ?vegetarian|non_vegetarian|meat|chicken|mutton|fish)\b/, "non_vegetarian"],
        [/\b(vegan|plant based|plant)\b/, "vegan"],
        [/\bjain\b/, "jain"],
        [/\b(egg|eggs|eggetarian)\b/, "eggetarian"],
        [/\b(veg|vegetarian|veggie|shakahari)\b/, "vegetarian"],
      ]);
      if (!v) return err("Please pick one: vegetarian, eggetarian, non-vegetarian, vegan or Jain.");
      a.diet = v;
      return { ok: true, answers: a };
    }
    case "allergies": {
      const v = parseAllergies(raw);
      if (v == null) return err("Pick any that apply — or choose None.");
      a.allergies = v === "none" ? [] : v;
      return { ok: true, answers: a };
    }
    case "region": {
      const r = parseRegion(raw);
      if (!r) return err("I couldn't find that one. Pick your state from the list — or choose “Outside India”.");
      a.region = r;
      return { ok: true, answers: a };
    }
    case "language": {
      const v = pick<Language>(raw, LANGUAGE_OPTIONS, [
        [/\b(hinglish|mix|mixed|both)\b/, "hinglish"],
        [/(\bhindi\b|हिंदी|हिन्दी|\bhi\b)/, "hi"],
        [/\b(english|en|eng)\b/, "en"],
      ]);
      if (!v) return err("Please pick English, Hindi or Hinglish.");
      a.language = v;
      return { ok: true, answers: a };
    }
    case "household": {
      const v = pick<HouseholdMode>(raw, HOUSEHOLD_OPTIONS, [
        [/\b(couple|partner|spouse|wife|husband|both of us|us two)\b/, "couple"],
        [/\b(family|kids|children|household|everyone)\b/, "family"],
        [/\b(caregiver|care|caring|parent|parents|mother|father|mom|dad|elder|grand)/, "caregiver"],
        [/\b(individual|just me|me|myself|alone|solo|single)\b/, "individual"],
      ]);
      if (!v) return err("Who's this for — just you, you and a partner, your family, or someone you care for?");
      a.household_mode = v;
      return { ok: true, answers: a };
    }
    case "lifestyle": {
      if (isSkip(raw)) {
        a.lifestyle = null;
        return { ok: true, answers: a };
      }
      const text = (Array.isArray(raw) ? raw.join(", ") : String(raw ?? "")).replace(/\s+/g, " ").trim();
      if (!text) return err("Type a few words about your routine — or tap Skip.");
      if (text.length > 300) return err("Could you keep it under 300 characters?");
      a.lifestyle = text;
      return { ok: true, answers: a };
    }
    case "summary":
      return { ok: true, answers: a };
  }
}

/** Summary step: "confirm" | "restart" | null (unrecognised). */
export function parseSummaryDecision(raw: Raw): "confirm" | "restart" | null {
  const w = words(norm(raw));
  if (!w) return null;
  if (/^(confirm|yes|y|yeah|yep|haan|han|ha|ok|okay|sure|go|save|done|looks good( let s go)?|perfect|great|chalo)\b/.test(w)) return "confirm";
  if (/\b(restart|start over|redo|again|change|edit|no|nahi)\b/.test(w)) return "restart";
  return null;
}

/* ───────────────────────────── Profile & targets ───────────────────────────── */

/** Profile fields from the answers, merged over the user's existing profile. */
export function buildProfile(answers: OnboardingAnswers, existing: Profile = {}, timezone = "Asia/Kolkata"): Profile {
  const p: Profile = {
    ...existing,
    goal: answers.goal ?? existing.goal,
    sex: answers.sex ?? existing.sex,
    age: answers.age ?? existing.age,
    height_cm: answers.height_cm ?? existing.height_cm,
    weight_kg: answers.weight_kg ?? existing.weight_kg,
    activity_level: answers.activity_level ?? existing.activity_level,
    diet: answers.diet ?? existing.diet,
    allergies: answers.allergies ?? existing.allergies ?? [],
    region: answers.region ?? existing.region,
    language: answers.language ?? existing.language,
    household_mode: answers.household_mode ?? existing.household_mode,
    timezone: existing.timezone || timezone,
  };
  if (answers.target_weight_kg != null) p.target_weight_kg = answers.target_weight_kg;
  else delete p.target_weight_kg;
  if (answers.lifestyle) p.lifestyle = answers.lifestyle;
  else delete p.lifestyle;
  // Never store `undefined` (Mongo would persist it as null).
  for (const k of Object.keys(p) as (keyof Profile)[]) if (p[k] === undefined) delete p[k];
  return p;
}

/** Default weekly pace used for the plan (matches computeTargets' defaults). */
export function weeklyRateFor(goal: GoalType) {
  return goal === "lose" ? -0.5 : goal === "gain" ? 0.25 : 0;
}

export interface OnboardingPlan {
  /** The goal the plan is built for: "maintain" when a loss plan wouldn't be safe (see `held`). */
  goal: GoalType;
  targets: Targets;
  bmr: number | null;
  tdee: number | null;
  /** Planned weekly change after the calorie floor (negative = loss). */
  weeklyRate: number;
  /** The 1200 kcal / BMR floor made the pace gentler than the default. */
  paceAdjusted: boolean;
  /** Target weight the plan works toward (null = none chosen, or not safe to plan). */
  target: number | null;
  weeks: number | null;
  /** YYYY-MM-DD, only when `today` was given. */
  targetDate: string | null;
  /** Why a loss request became balanced targets: already under a healthy BMI, or no room above the calorie floor. */
  held: "underweight" | "energy_floor" | null;
}

/**
 * The plan behind the summary and the saved goal — built with the Goals calculator's own rules
 * (`planGoal`: calorie floor, pace adjustment, no-deficit blocker; healthy-BMI floor for targets).
 */
export function planFor(a: OnboardingAnswers, today?: string): OnboardingPlan {
  const profile = buildProfile(a);
  const split = (t: ReturnType<typeof computeTargets>) => {
    const { bmr, tdee, ...targets } = t;
    return { targets: targets as Targets, bmr, tdee };
  };
  const balanced = (held: OnboardingPlan["held"]): OnboardingPlan => ({
    goal: "maintain",
    ...split(computeTargets(profile, { goal: "maintain", weeklyRateKg: 0 })),
    weeklyRate: 0,
    paceAdjusted: false,
    target: null,
    weeks: null,
    targetDate: null,
    held,
  });

  if (lossHeldForBmi(a) || (a.goal === "lose" && isUnderweight(a))) return balanced("underweight");

  const goal = a.goal || "maintain";
  const current = a.weight_kg;
  if ((goal !== "lose" && goal !== "gain") || !current) {
    const weeklyRate = weeklyRateFor(goal);
    const t = split(computeTargets(profile, { goal, weeklyRateKg: weeklyRate }));
    return { goal, ...t, weeklyRate, paceAdjusted: false, target: null, weeks: null, targetDate: null, held: null };
  }

  // A loss target under the healthy floor (only possible in answers saved before that check existed) is ignored.
  let target = a.target_weight_kg ?? null;
  if (target != null && goal === "lose" && a.height_cm && target < healthyFloorKg(a.height_cm)) target = null;

  const plan = planGoal({ profile, goal, current, target: target ?? current, rate: weeklyRateFor(goal), today: today || "2000-01-01" });
  if (plan.blocker) return balanced("energy_floor");
  return {
    goal,
    targets: plan.targets,
    bmr: plan.bmr,
    tdee: plan.tdee,
    weeklyRate: plan.weeklyRate,
    paceAdjusted: plan.paceAdjusted,
    target,
    weeks: target != null ? plan.weeks : null,
    targetDate: target != null && today ? plan.targetDate : null,
    held: null,
  };
}

export function targetsFor(answers: OnboardingAnswers) {
  const plan = planFor(answers);
  return { targets: plan.targets, bmr: plan.bmr, tdee: plan.tdee, goal: plan.goal };
}

/** "0.5", "0.25", "0.06" — kg per week without trailing zeros. */
const kgPerWeek = (rate: number) => `${round(Math.abs(rate), 2)}`;

/** "10 weeks", "5 months", "about 2 years". */
function durationText(weeks: number): string {
  if (weeks <= 26) return `${weeks} week${weeks === 1 ? "" : "s"}`;
  const months = Math.round((weeks * 7) / 30.44);
  if (months < 24) return `${months} months`;
  return `about ${round(months / 12, 1)} years`;
}

function goalLine(a: OnboardingAnswers, plan: OnboardingPlan): string {
  if (plan.held === "underweight")
    return "You're already at the lower end of the healthy range for your height, so these are balanced targets rather than a deficit. If you'd still like to lose weight, please check with your doctor first.";
  if (plan.held === "energy_floor")
    return "Your daily energy needs are already close to the safe minimum, so I've set balanced targets instead of a deficit. A little more movement is a kinder place to start — or chat with a nutritionist.";
  const floorNote = plan.paceAdjusted ? " I've kept the pace gentle so your daily energy never drops below a safe minimum — a little more movement will speed things up." : "";
  if ((plan.goal === "lose" || plan.goal === "gain") && plan.target != null && plan.weeks) {
    return `Aiming for ${formatWeight(plan.target, a.weight_unit)} at about ${kgPerWeek(plan.weeklyRate)} kg a week — roughly ${durationText(plan.weeks)}.${floorNote}`;
  }
  if (plan.goal === "lose") return `A gentle deficit of about ${kgPerWeek(plan.weeklyRate)} kg a week.${floorNote}`;
  if (plan.goal === "gain") return `A gentle surplus of about ${kgPerWeek(plan.weeklyRate)} kg a week.`;
  if (a.goal_focus === "healthier") return "Balanced targets to help you eat a little better every day.";
  if (a.goal_focus === "track") return "Balanced targets to track against — no pressure.";
  return "Balanced targets to keep you steady.";
}

export function planSummary(a: OnboardingAnswers): PlanSummary {
  const plan = planFor(a);
  const { targets, bmr, tdee, goal } = plan;
  const facts = [
    a.age != null && a.sex ? { label: "You", value: `${labelOf(SEX_OPTIONS, a.sex).split(" /")[0]}, ${a.age}` } : null,
    a.height_cm ? { label: "Height", value: formatHeight(a.height_cm, a.height_unit) } : null,
    a.weight_kg ? { label: "Weight", value: plan.target != null ? `${formatKg(a.weight_kg)} → ${formatKg(plan.target)}` : formatKg(a.weight_kg) } : null,
    a.activity_level ? { label: "Activity", value: labelOf(ACTIVITY_OPTIONS, a.activity_level) } : null,
    a.diet ? { label: "Diet", value: labelOf(DIET_OPTIONS, a.diet) } : null,
    a.region ? { label: "Region", value: a.region } : null,
  ].filter(Boolean) as { label: string; value: string }[];
  return {
    targets: {
      calories: targets.calories,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      fiber_g: targets.fiber_g,
      water_glasses: targets.water_glasses,
      steps: targets.steps,
    },
    bmr,
    tdee,
    goal,
    goal_line: goalLine(a, plan),
    facts,
  };
}

function summaryText(a: OnboardingAnswers, name: string): string {
  const s = planSummary(a);
  const t = s.targets;
  return join(
    `Here's your starting plan, ${firstName(name)}:`,
    [
      `• Energy: about ${formatNumber(t.calories)} kcal a day`,
      `• Protein ${t.protein_g} g · Carbs ${t.carbs_g} g · Fat ${t.fat_g} g`,
      `• Water: ${t.water_glasses} glasses · Steps: ${formatNumber(t.steps)}`,
    ].join("\n"),
    `${s.goal_line} These are gentle starting points — you can fine-tune them anytime in Settings.`,
    "Shall I save this?"
  );
}

/**
 * First durable facts for ÖRZA's memory (short, human-readable). Pass the saved `plan` so a loss request
 * that became balanced targets is remembered that way.
 */
export function memoryFacts(a: OnboardingAnswers, plan?: Pick<OnboardingPlan, "held" | "target">): string[] {
  const facts: string[] = [];
  const focus = a.goal_focus || a.goal;
  const held = plan?.held ?? (lossHeldForBmi(a) ? "underweight" : null);
  const target = plan ? plan.target : a.target_weight_kg;
  if (held === "underweight") {
    facts.push("Goal: wanted to lose weight, but is already at the low end of a healthy BMI — balanced targets, no deficit");
  } else if (held === "energy_floor") {
    facts.push("Goal: wanted to lose weight, but energy needs are near the safe minimum — balanced targets, no deficit");
  } else if (focus) {
    const goalText = {
      lose: "Goal: lose weight",
      gain: "Goal: gain weight or muscle",
      maintain: "Goal: maintain weight",
      track: "Goal: track what they eat",
      healthier: "Goal: eat healthier",
    }[focus];
    facts.push(target != null ? `${goalText} (target ${formatKg(target)})` : goalText);
  }
  if (a.diet) facts.push(`Diet: ${labelOf(DIET_OPTIONS, a.diet).toLowerCase()}`);
  if (a.allergies) facts.push(a.allergies.length ? `Allergies / avoids: ${a.allergies.join(", ")}` : "No food allergies");
  if (a.region) facts.push(a.region === OUTSIDE_INDIA ? "Lives outside India" : `Lives in ${a.region}`);
  if (a.language) facts.push(`Prefers chatting in ${labelOf(LANGUAGE_OPTIONS, a.language).split(" (")[0]}`);
  if (a.household_mode && a.household_mode !== "individual") facts.push(`Tracking for: ${labelOf(HOUSEHOLD_OPTIONS, a.household_mode).toLowerCase()}`);
  if (a.lifestyle) facts.push(`Routine: ${a.lifestyle}`);
  // Keep every fact within Settings → Memory's per-item limit (200), or saving the list there would fail.
  return facts.map((f) => (f.length <= 200 ? f : `${f.slice(0, 199).trimEnd()}…`));
}

/** Merge new facts into memory: case-insensitive dedupe, newest last, max 30 (diet/allergy/avoid facts from chat are kept first, see capMemory). */
export function mergeMemory(existing: string[] = [], facts: string[]): string[] {
  const seen = new Set(facts.map((f) => f.toLowerCase()));
  // Replace older onboarding facts with the same prefix (e.g. "Diet: …").
  const prefixes = new Set(facts.map((f) => f.split(":")[0].toLowerCase()).filter((p) => p.length < 30));
  const kept = existing.filter((m) => !seen.has(m.toLowerCase()) && !(m.includes(":") && prefixes.has(m.split(":")[0].toLowerCase())));
  return capMemory([...kept, ...facts], 30);
}

/* ───────────────────────────── Transcript ───────────────────────────── */

/**
 * Rebuild the conversation so far (for page reloads): every answered step's question and
 * answer, plus the prompt for the current step (with the pending acknowledgement).
 */
export function conversationFor(step: StepId, answers: OnboardingAnswers, name: string): { history: ChatLine[]; prompt: StepPrompt } {
  const history: ChatLine[] = [];
  let ack = "";
  for (const s of sequenceFor(answers)) {
    if (s === step || s === "summary") break;
    history.push({ role: "assistant", content: join(ack, question(s, answers, name, s === "goal")) });
    history.push({ role: "user", content: answerLabel(s, answers) });
    ack = ackFor(s, answers);
  }
  return { history, prompt: promptFor(step, answers, { name, ack, intro: step === "goal" && history.length === 0 }) };
}
