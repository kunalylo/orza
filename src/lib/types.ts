/**
 * Shared data model. Every stored document has a string `id` (uuid);
 * Mongo's internal `_id` is never exposed. Dates are ISO strings.
 * `date` fields are local calendar days in the user's timezone: "YYYY-MM-DD".
 */

export type Sex = "male" | "female" | "other";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose" | "maintain" | "gain";
export type Diet = "vegetarian" | "vegan" | "eggetarian" | "non_vegetarian" | "jain";
export type Language = "en" | "hi" | "hinglish";
export type HouseholdMode = "individual" | "couple" | "caregiver" | "family";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealSource = "photo" | "text" | "voice" | "manual" | "chat";

export interface Profile {
  age?: number;
  sex?: Sex;
  height_cm?: number;
  weight_kg?: number;
  target_weight_kg?: number;
  activity_level?: ActivityLevel;
  goal?: GoalType;
  diet?: Diet;
  allergies?: string[];
  conditions?: string[]; // free text the user chose to share (never used to diagnose)
  region?: string; // e.g. "Punjab", "Kerala"
  language?: Language;
  household_mode?: HouseholdMode;
  lifestyle?: string; // e.g. "desk job", "night shifts"
  timezone?: string; // IANA, default Asia/Kolkata
}

export interface Targets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_glasses: number;
  steps: number;
}

export interface Preferences {
  units: "metric" | "imperial";
  reminders: boolean;
  weekly_report: boolean;
  tone: "gentle" | "direct";
  /** When true, the user's data is excluded from any future model-improvement use (see the Trust page). */
  ai_training_opt_out?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  onboarding_complete: boolean;
  is_admin?: boolean;
  credits: number;
  profile: Profile;
  targets: Targets;
  preferences: Preferences;
  memory: string[]; // short facts ÖRZA remembers (max 30)
}

export type PublicUser = Omit<User, "password_hash">;

export interface Nutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface MealItem extends Nutrients {
  name: string;
  quantity: number; // e.g. 2
  unit: string; // e.g. "roti", "katori", "plate", "g"
  grams?: number;
  confidence?: number; // 0..1
}

export interface Meal {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  source: MealSource;
  description: string;
  items: MealItem[];
  totals: Nutrients;
  notes?: string;
  created_at: string;
}

export interface Scan {
  id: string;
  user_id: string;
  items: MealItem[];
  totals: Nutrients;
  dish_name: string;
  notes?: string;
  confidence: number;
  confirmed: boolean;
  meal_id?: string;
  created_at: string;
}

export interface TrackingDay {
  id: string;
  user_id: string;
  date: string;
  water_glasses: number;
  steps: number;
  weight_kg?: number;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  meta?: { logged_meal_id?: string; ai?: boolean; remembered?: string[] };
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  active: boolean;
  goal: GoalType;
  current_weight_kg: number;
  target_weight_kg: number;
  weekly_rate_kg: number; // planned change per week (negative = loss)
  target_date?: string;
  bmr: number;
  tdee: number;
  targets: Targets;
  created_at: string;
}

export interface CompensationDay {
  date: string;
  calorie_target: number;
  adjustment: number; // negative kcal vs usual target
  focus: string;
  activity: string;
  meals: string[];
}

export interface CompensationPlan {
  id: string;
  user_id: string;
  occasion: string;
  extra_calories: number;
  days: CompensationDay[];
  message: string;
  created_at: string;
}

export interface Recipe {
  id: string;
  user_id: string;
  title: string;
  cuisine: string;
  description: string;
  prep_minutes: number;
  servings: number;
  ingredients: string[];
  steps: string[];
  nutrition: Nutrients; // per serving
  tags: string[];
  saved: boolean;
  created_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number; // + grant, - spend
  reason: string;
  balance_after: number;
  created_at: string;
}

export interface Lead {
  id: string;
  email: string;
  source: string;
  message?: string;
  created_at: string;
}
