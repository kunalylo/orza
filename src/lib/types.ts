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

/**
 * Staff role of an admin account. "super" manages the team (adds/removes sub-admins); "sub" runs the
 * day-to-day console (members, credits, credit requests). An admin without a role counts as "sub".
 */
export type AdminRole = "super" | "sub";

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  onboarding_complete: boolean;
  /** Staff account: uses the separate admin console only, never the member app. */
  is_admin?: boolean;
  /** Only meaningful when `is_admin` is true (see {@link AdminRole}). */
  admin_role?: AdminRole;
  credits: number;
  profile: Profile;
  targets: Targets;
  preferences: Preferences;
  memory: string[]; // short facts ÖRZA remembers (max 30)
  integrations?: Integrations;
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
  /** The AI action (a `CreditAction` key) for spends and refunds; absent on grants and older records. */
  action?: string;
  balance_after: number;
  created_at: string;
}

/** "web": a browser signed in with the httpOnly cookie. "mobile": the ÖRZA iOS/Android app, signed in with a Bearer token. */
export type SessionKind = "web" | "mobile";

/** Platforms of the ÖRZA phone app. */
export type AppPlatform = "ios" | "android";

/**
 * A signed-in browser or phone app. The session token (a signed JWT, sent as the cookie on the web or
 * as `Authorization: Bearer` by the app) carries this id; deleting the document revokes that token
 * immediately, even if a copy of it is still within its 30-day lifetime.
 */
export interface Session {
  id: string;
  user_id: string;
  /** How the session signs in. Sessions created before the phone app existed have none and are "web". */
  kind?: SessionKind;
  /** Phone app only: the device name the app reported (e.g. "Asha's iPhone"). */
  device_label?: string;
  /** Phone app only. */
  platform?: AppPlatform;
  created_at: string;
  expires_at: string; // ISO; matches the token's expiry
}

export interface Lead {
  id: string;
  email: string;
  source: string;
  message?: string;
  created_at: string;
}

/* ─────────────────────────── Care: medicines, reminders, health ─────────────────────────── */

/** An uploaded image (medicine photo, prescription). Stored as base64 in the `media` collection. */
export interface Media {
  id: string;
  user_id: string;
  kind: "medicine" | "prescription" | "meal" | "other";
  mime: "image/jpeg" | "image/png" | "image/webp";
  data: string; // base64 (no data: prefix)
  bytes: number;
  width?: number;
  height?: number;
  created_at: string;
}

export type MedForm = "tablet" | "capsule" | "syrup" | "drops" | "injection" | "inhaler" | "cream" | "powder" | "other";
export type DoseTiming = "before_food" | "after_food" | "with_food" | "empty_stomach" | "bedtime" | "any";

/** When a medicine / reminder fires. Times are the user's local wall-clock "HH:MM" (24h) in profile.timezone. */
export interface Schedule {
  times: string[]; // e.g. ["08:00", "20:00"]
  days: number[]; // 0 = Sunday … 6 = Saturday; empty = every day
  start_date: string; // YYYY-MM-DD (local)
  end_date?: string; // inclusive, YYYY-MM-DD (local); omitted = ongoing
  every_n_days?: number; // e.g. 2 = alternate days (counted from start_date); omitted/1 = daily
}

export interface Medication {
  id: string;
  user_id: string;
  name: string; // "Metformin"
  strength?: string; // "500 mg"
  form: MedForm;
  dose: string; // "1 tablet", "5 ml"
  timing: DoseTiming;
  instructions?: string;
  photo_ids: string[]; // Media ids; the first is shown on alarms
  schedule: Schedule;
  as_needed: boolean; // SOS — never alarms, can be logged manually
  active: boolean;
  stock?: { count: number; unit: string; refill_alert_at?: number };
  prescription_id?: string;
  for_person?: string; // caregiver mode, e.g. "Mom"
  created_at: string;
  updated_at: string;
}

export interface ExtractedMedicine {
  name: string;
  strength?: string;
  form: MedForm;
  dose: string;
  timing: DoseTiming;
  times: string[]; // derived local times "HH:MM"
  frequency_text: string; // as written: "1-0-1", "BD", "TDS x 5 days"
  duration_days?: number;
  as_needed: boolean;
  instructions?: string;
  confidence?: number;
}

export interface Prescription {
  id: string;
  user_id: string;
  media_id?: string;
  doctor?: string;
  issued_on?: string;
  notes?: string;
  medicines: ExtractedMedicine[];
  status: "review" | "applied";
  applied_medication_ids?: string[];
  created_at: string;
}

export type DoseStatus = "taken" | "skipped" | "snoozed" | "missed";

export interface DoseLog {
  id: string; // `${medication_id}:${scheduled_for}` — one per scheduled occurrence
  user_id: string;
  medication_id: string;
  scheduled_for: string; // ISO UTC instant of the scheduled occurrence
  local_date: string; // YYYY-MM-DD
  local_time: string; // HH:MM
  status: DoseStatus;
  acted_at?: string;
  snooze_until?: string; // ISO UTC
  created_at: string;
}

export type ReminderKind = "meal" | "water" | "weight" | "custom";

export interface ReminderChannels {
  push: boolean;
  whatsapp: boolean;
  calendar: boolean; // include in the ICS calendar feed
}

export interface Reminder {
  id: string;
  user_id: string;
  kind: ReminderKind;
  title: string;
  body?: string;
  schedule: Schedule;
  channels: ReminderChannels;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PushSubscriptionDoc {
  id: string;
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
  created_at: string;
}

/**
 * A phone running the ÖRZA app (collection `devices`), registered by the app with `POST /api/devices`
 * after sign-in and on every launch. One per app session; revoking the session removes it.
 */
export interface AppDevice {
  id: string;
  user_id: string;
  /** The app's session (kind "mobile") that registered the device. */
  session_id: string;
  platform: AppPlatform;
  label: string;
  /** Expo push token (`ExponentPushToken[…]`), when the user allowed notifications. A credential — never returned to clients. */
  push_token?: string;
  app_version: string;
  /** The phone's IANA timezone. */
  timezone: string;
  last_seen_at: string;
  /** The app rings medicine alarms itself (local notifications), so the server skips Web Push for doses while it is active. */
  alarms_local: boolean;
  created_at: string;
  updated_at: string;
}

/** Idempotency record: one per (source, occurrence) so a reminder is never sent twice. */
export interface Dispatch {
  id: string; // `${source}:${source_id}:${occurrence_iso}`
  user_id: string;
  source: "medication" | "reminder" | "refill";
  source_id: string;
  occurrence: string; // ISO UTC
  channels: string[]; // channels that were attempted
  results: Record<string, string>; // channel → "sent" | error message
  created_at: string;
}

export type HealthSource = "apple_health" | "health_connect" | "health_auto_export" | "shortcut" | "csv" | "manual" | "api";

/** Daily health aggregates from phones / wearables (one per user + date + source). */
export interface HealthDay {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  source: HealthSource;
  steps?: number;
  active_kcal?: number;
  distance_km?: number;
  sleep_minutes?: number;
  resting_hr?: number;
  avg_hr?: number;
  weight_kg?: number;
  water_ml?: number;
  updated_at: string;
}

/** Per-user integration secrets and settings. Tokens are stored hashed (sha256); only a preview is kept. */
export interface Integrations {
  health_token_hash?: string;
  health_token_preview?: string; // last 4 chars
  health_token_created_at?: string;
  calendar_token?: string; // random, used in the public ICS feed URL (revocable)
  external_ical_url?: string; // user's secret iCal address (Google/Apple/Outlook) — read-only import
  whatsapp_phone?: string; // E.164, e.g. +919876543210
  whatsapp_opt_in?: boolean;
  quiet_hours?: { start: string; end: string }; // local "HH:MM" — no push/WhatsApp inside
}
