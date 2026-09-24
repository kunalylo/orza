/**
 * Onboarding persistence + response shaping shared by the onboarding routes.
 * The conversation logic itself lives in `@/lib/onboarding` (pure).
 */
import { toPublicUser } from "@/lib/auth";
import { dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { col, newId, nowISO } from "@/lib/db";
import { setTracking } from "@/lib/domain/tracking";
import {
  OUTSIDE_INDIA,
  buildProfile,
  conversationFor,
  memoryFacts,
  mergeMemory,
  planFor,
  progressOf,
  sequenceFor,
  type OnboardingAnswers,
  type OnboardingState,
  type StepId,
  type StepPrompt,
} from "@/lib/onboarding";
import type { Goal, Preferences, User } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

const states = () => col<OnboardingState>("onboarding");

/** The user's saved onboarding state (fresh state if none). Repairs steps that no longer fit the answers. */
export async function loadState(user: User): Promise<OnboardingState> {
  const s = (await states().findOne({ user_id: user.id })) ?? {
    id: "",
    user_id: user.id,
    step: "goal" as StepId,
    answers: {},
    updated_at: "",
  };
  const answers = s.answers || {};
  let step = s.step;
  // Completion was interrupted (state saved, user not updated): ask to confirm again.
  if (step === "complete" && !user.onboarding_complete) step = "summary";
  if (step !== "complete" && !sequenceFor(answers).includes(step)) step = "goal";
  return { ...s, step, answers };
}

export async function saveState(userId: string, step: StepId, answers: OnboardingAnswers) {
  await states().updateOne(
    { user_id: userId },
    { $set: { step, answers, updated_at: nowISO() }, $setOnInsert: { id: newId() } },
    { upsert: true }
  );
}

/** Shape for a step response: `{reply, step, options?, input, done, prompt, progress, answers, valid}`. */
export function stepResponse(prompt: StepPrompt, answers: OnboardingAnswers, extra: Record<string, unknown> = {}) {
  return {
    reply: prompt.message,
    step: prompt.step,
    options: prompt.options,
    input: prompt.input,
    done: prompt.step === "complete",
    prompt,
    progress: progressOf(prompt.step, answers),
    answers,
    valid: true,
    ...extra,
  };
}

/** GET / restart payload: `{step, answers, done, prompt, history, progress}`. */
export function statePayload(user: User, state: OnboardingState) {
  const done = !!user.onboarding_complete;
  if (done) {
    return { step: "complete" as StepId, answers: state.answers, done, prompt: null, history: [], progress: progressOf("complete", state.answers) };
  }
  const { history, prompt } = conversationFor(state.step, state.answers, user.name);
  return { step: state.step, answers: state.answers, done, prompt, history, progress: progressOf(state.step, state.answers) };
}

/** A real IANA zone name (e.g. "America/New_York", "UTC"). */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64 || !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The timezone to save: the device's zone when the browser reported one, so "today", meal types and
 * reminders follow the user's clock (vital outside India) — unless they already chose one in Settings.
 */
function timezoneFor(user: User, answers: OnboardingAnswers, deviceTz?: string): string {
  const saved = user.profile?.timezone;
  if (saved && saved !== DEFAULT_TZ) return saved; // changed from the sign-up default on purpose
  if (deviceTz && isTimeZone(deviceTz)) {
    // An India-based user on a device set to another zone is most likely travelling: keep IST unless they live abroad.
    if (answers.region && answers.region !== OUTSIDE_INDIA && !/^Asia\/(Kolkata|Calcutta)$/.test(deviceTz)) return DEFAULT_TZ;
    return deviceTz;
  }
  return saved || DEFAULT_TZ;
}

/**
 * Finish onboarding: save profile + targets + first memory facts, mark complete,
 * record the starting weight and (for lose/gain with a safe target) an active goal.
 * `deviceTz` is the browser's IANA timezone, validated before use.
 */
export async function completeOnboarding(user: User, answers: OnboardingAnswers, deviceTz?: string) {
  const tz = timezoneFor(user, answers, deviceTz);
  const today = dateInTz(tz);
  const plan = planFor(answers, today);
  const { targets, bmr, tdee, goal } = plan;
  const profile = buildProfile(answers, { ...(user.profile || {}), timezone: tz }, tz);
  // Save the goal the plan was built for (a loss request can become balanced targets for safety).
  profile.goal = goal;
  if (plan.target != null) profile.target_weight_kg = plan.target;
  else delete profile.target_weight_kg;
  const preferences: Preferences = {
    units: answers.weight_unit === "lb" ? "imperial" : user.preferences?.units ?? "metric",
    reminders: user.preferences?.reminders ?? true,
    weekly_report: user.preferences?.weekly_report ?? true,
    tone: user.preferences?.tone ?? "gentle",
  };
  const now = nowISO();

  const updated = await col<User>("users").findOneAndUpdate(
    { id: user.id },
    {
      $set: {
        profile,
        targets,
        preferences,
        memory: mergeMemory(user.memory || [], memoryFacts(answers, plan)),
        onboarding_complete: true,
        updated_at: now,
      },
    }
  );
  if (!updated) throw new Error("User disappeared during onboarding");

  // Nice-to-haves for day one; never block completion on them.
  try {
    if (answers.weight_kg) await setTracking(user.id, today, { weight_kg: answers.weight_kg });
    if ((goal === "lose" || goal === "gain") && plan.target != null && plan.targetDate && answers.weight_kg) {
      const goals = col<Goal>("goals");
      for (const g of await goals.find({ user_id: user.id, active: true })) {
        await goals.updateOne({ id: g.id, user_id: user.id }, { $set: { active: false } });
      }
      // Same pace and date the summary showed (calorie floor applied), like /api/goals/calculate.
      await goals.insertOne({
        id: newId(),
        user_id: user.id,
        active: true,
        goal,
        current_weight_kg: answers.weight_kg,
        target_weight_kg: plan.target,
        weekly_rate_kg: plan.weeklyRate,
        target_date: plan.targetDate,
        bmr: bmr ?? 0,
        tdee: tdee ?? 0,
        targets,
        created_at: now,
      });
    }
  } catch (e) {
    console.warn("[orza] onboarding extras failed", e);
  }

  await saveState(user.id, "complete", answers);

  const first = (updated.name || "").trim().split(/\s+/)[0] || "there";
  return {
    user: toPublicUser(updated),
    reply: [
      `All set, ${first}! Your plan is saved — about ${formatNumber(targets.calories)} kcal and ${targets.protein_g} g protein a day.`,
      "Whenever you're ready, snap or tell me your first meal.",
    ].join("\n\n"),
  };
}
