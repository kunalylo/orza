import { z } from "zod";
import { requireUser, toPublicUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { dateInTz } from "@/lib/dates";
import { computeTargets } from "@/lib/domain/targets";
import { setTracking } from "@/lib/domain/tracking";
import { json, parseBody, route } from "@/lib/http";
import { memoryFacts, type OnboardingAnswers } from "@/lib/onboarding";
import type { Goal, Profile, Targets, User } from "@/lib/types";
import { round } from "@/lib/utils";
import {
  ACTIVITY_LEVELS,
  DIETS,
  GOAL_TYPES,
  HOUSEHOLD_MODES,
  LANGUAGES,
  MEMORY_MAX_ITEMS,
  PROFILE_LIMITS as L,
  SEXES,
  TARGET_DRIVERS,
} from "@/components/account/options";

export const dynamic = "force-dynamic";

/* ───────────────────────────── Validation ───────────────────────────── */

/** `null` or "" clears a field (→ $unset). */
const clearable = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || (typeof v === "string" && !v.trim()) ? null : v), schema.nullable());

const num = (label: string, unit: string, { min, max }: { min: number; max: number }, digits = 1) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(min, `${label} must be at least ${min}${unit}`)
    .max(max, `${label} must be at most ${max}${unit}`)
    .transform((n) => round(n, digits));

const words = (label: string, { maxItems, maxLength }: { maxItems: number; maxLength: number }, lower = false) =>
  z
    .array(z.string().trim().min(1).max(maxLength, `Each ${label} must be ${maxLength} characters or fewer`), {
      invalid_type_error: `${label} must be a list`,
    })
    .max(maxItems, `Add at most ${maxItems} ${label}`)
    .transform((list) => {
      const seen = new Set<string>();
      return list
        .map((s) => s.replace(/\s+/g, " "))
        .map((s) => (lower ? s.toLowerCase() : s))
        .filter((s) => (seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true)));
    });

const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const ProfilePatch = z
  .object({
    age: clearable(
      z.coerce
        .number({ invalid_type_error: "Age must be a number" })
        .int("Age must be a whole number")
        .min(L.age.min, `ÖRZA is for ages ${L.age.min} and up`)
        .max(L.age.max, `Age must be ${L.age.max} or below`)
    ),
    sex: clearable(z.enum(SEXES, { errorMap: () => ({ message: "Choose female, male or other" }) })),
    height_cm: clearable(num("Height", " cm", L.height_cm)),
    weight_kg: clearable(num("Weight", " kg", L.weight_kg)),
    target_weight_kg: clearable(num("Target weight", " kg", L.weight_kg)),
    activity_level: clearable(z.enum(ACTIVITY_LEVELS, { errorMap: () => ({ message: "Choose an activity level" }) })),
    goal: clearable(z.enum(GOAL_TYPES, { errorMap: () => ({ message: "Choose lose, maintain or gain" }) })),
    diet: clearable(z.enum(DIETS, { errorMap: () => ({ message: "Choose a diet" }) })),
    allergies: clearable(words("allergies", L.allergies, true)),
    conditions: clearable(words("conditions", L.conditions)),
    region: clearable(z.string().trim().max(L.region.maxLength, `Region must be ${L.region.maxLength} characters or fewer`)),
    language: clearable(z.enum(LANGUAGES, { errorMap: () => ({ message: "Choose English, Hindi or Hinglish" }) })),
    household_mode: clearable(z.enum(HOUSEHOLD_MODES, { errorMap: () => ({ message: "Choose a household mode" }) })),
    lifestyle: clearable(
      z.string().trim().max(L.lifestyle.maxLength, `Routine must be ${L.lifestyle.maxLength} characters or fewer`)
    ),
    timezone: z.string().trim().max(64).refine(isTimeZone, "Unknown timezone"),
  })
  .partial();

const Body = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter your name")
    .max(L.name.maxLength, `Please keep your name under ${L.name.maxLength} characters`)
    .optional(),
  profile: ProfilePatch.optional(),
  /** Default: recompute only when a target-driving field changed. `true` forces a recompute ("Reset to recommended"). */
  recompute_targets: z.boolean().optional(),
});

/* ───────────────────────────── Helpers ───────────────────────────── */

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Recommended targets for a profile; honours the pace of an active goal of the same kind. */
async function recommendedTargets(userId: string, profile: Profile): Promise<Targets> {
  const active = await col<Goal>("goals").findOne({ user_id: userId, active: true });
  const goal = profile.goal ?? active?.goal;
  const opts = active && active.goal === goal ? { goal, weeklyRateKg: active.weekly_rate_kg } : { goal };
  const t = computeTargets(profile, opts);
  return {
    calories: t.calories,
    protein_g: t.protein_g,
    carbs_g: t.carbs_g,
    fat_g: t.fat_g,
    fiber_g: t.fiber_g,
    water_glasses: t.water_glasses,
    steps: t.steps,
  };
}

/** Memory facts derived from profile fields — replaced when the field changes so ÖRZA never remembers stale details. */
const FACT_PATTERNS: Partial<Record<keyof Profile, RegExp[]>> = {
  goal: [/^goal:/i],
  diet: [/^diet:/i],
  allergies: [/^allergies \/ avoids:/i, /^no food allergies$/i],
  region: [/^lives in /i, /^lives outside india$/i],
  language: [/^prefers chatting in /i],
  household_mode: [/^tracking for:/i],
  lifestyle: [/^routine:/i],
};

function syncMemory(memory: string[], profile: Profile, changed: Set<keyof Profile>): string[] | null {
  const fields = (Object.keys(FACT_PATTERNS) as (keyof Profile)[]).filter((k) => changed.has(k));
  if (!fields.length) return null;
  const patterns = fields.flatMap((k) => FACT_PATTERNS[k] ?? []);
  const kept = memory.filter((m) => !patterns.some((p) => p.test(m)));
  const answers: OnboardingAnswers = {};
  if (changed.has("goal") && profile.goal) {
    answers.goal = profile.goal;
    if (profile.goal !== "maintain" && profile.target_weight_kg != null) answers.target_weight_kg = profile.target_weight_kg;
  }
  if (changed.has("diet") && profile.diet) answers.diet = profile.diet;
  if (changed.has("allergies") && profile.allergies) answers.allergies = profile.allergies;
  if (changed.has("region") && profile.region) answers.region = profile.region;
  if (changed.has("language") && profile.language) answers.language = profile.language;
  if (changed.has("household_mode") && profile.household_mode) answers.household_mode = profile.household_mode;
  if (changed.has("lifestyle") && profile.lifestyle) answers.lifestyle = profile.lifestyle;
  const fresh = memoryFacts(answers).filter((f) => !kept.some((m) => m.toLowerCase() === f.toLowerCase()));
  const next = [...kept, ...fresh].slice(-MEMORY_MAX_ITEMS);
  return same(next, memory) ? null : next;
}

/* ───────────────────────────── Routes ───────────────────────────── */

/** GET /api/profile → {user} */
export const GET = route(async () => {
  const user = await requireUser();
  return json({ user: toPublicUser(user) }, { headers: { "Cache-Control": "no-store" } });
});

/**
 * PUT /api/profile {name?, profile?, recompute_targets?} → {user, targets_recomputed}
 * Updates only the provided fields (dotted paths). Recomputes daily targets when age/sex/height/weight/
 * activity/goal changed (unless recompute_targets is false) or when recompute_targets is true.
 */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);

  const current: Profile = user.profile || {};
  const merged: Profile = { ...current };
  const changed = new Set<keyof Profile>();
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  if (body.name !== undefined && body.name !== user.name) $set.name = body.name;

  for (const [key, value] of Object.entries(body.profile || {}) as [keyof Profile, unknown][]) {
    if (value === undefined) continue;
    if (value === null) {
      if (current[key] === undefined) continue;
      $unset[`profile.${key}`] = "";
      delete merged[key];
      changed.add(key);
      continue;
    }
    if (same(current[key], value)) continue;
    $set[`profile.${key}`] = value;
    (merged as Record<string, unknown>)[key] = value;
    changed.add(key);
  }

  const driverChanged = TARGET_DRIVERS.some((k) => changed.has(k));
  const recompute = body.recompute_targets === true || (body.recompute_targets !== false && driverChanged);
  if (recompute) {
    const targets = await recommendedTargets(user.id, merged);
    if (!same(targets, user.targets)) $set.targets = targets;
  }

  const memory = syncMemory(user.memory || [], merged, changed);
  if (memory) $set.memory = memory;

  if (!Object.keys($set).length && !Object.keys($unset).length) {
    return json({ user: toPublicUser(user), targets_recomputed: recompute });
  }

  $set.updated_at = nowISO();
  const updated = await col<User>("users").findOneAndUpdate(
    { id: user.id },
    Object.keys($unset).length ? { $set, $unset } : { $set }
  );

  // A new weight in Settings counts as today's weigh-in, like /api/track/weight.
  if (changed.has("weight_kg") && merged.weight_kg != null) {
    await setTracking(user.id, dateInTz(merged.timezone), { weight_kg: merged.weight_kg }).catch((e) =>
      console.warn("[orza] profile weight → tracking failed", e)
    );
  }

  return json({ user: toPublicUser(updated ?? { ...user, profile: merged }), targets_recomputed: recompute });
});
