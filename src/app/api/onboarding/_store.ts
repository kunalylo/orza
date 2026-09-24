/**
 * Onboarding persistence + response shaping shared by the onboarding routes.
 * The conversation logic itself lives in `@/lib/onboarding` (pure).
 */
import { toPublicUser } from "@/lib/auth";
import { addDays, dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { col, newId, nowISO } from "@/lib/db";
import { setTracking } from "@/lib/domain/tracking";
import {
  buildProfile,
  conversationFor,
  memoryFacts,
  mergeMemory,
  progressOf,
  sequenceFor,
  targetsFor,
  weeklyRateFor,
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

/**
 * Finish onboarding: save profile + targets + first memory facts, mark complete,
 * record the starting weight and (for lose/gain with a target) an active goal.
 */
export async function completeOnboarding(user: User, answers: OnboardingAnswers) {
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const { targets, bmr, tdee, goal } = targetsFor(answers);
  const profile = buildProfile(answers, user.profile || {}, tz);
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
        memory: mergeMemory(user.memory || [], memoryFacts(answers)),
        onboarding_complete: true,
        updated_at: now,
      },
    }
  );
  if (!updated) throw new Error("User disappeared during onboarding");

  // Nice-to-haves for day one; never block completion on them.
  const today = dateInTz(tz);
  try {
    if (answers.weight_kg) await setTracking(user.id, today, { weight_kg: answers.weight_kg });
    if ((goal === "lose" || goal === "gain") && answers.target_weight_kg != null && answers.weight_kg) {
      const goals = col<Goal>("goals");
      for (const g of await goals.find({ user_id: user.id, active: true })) {
        await goals.updateOne({ id: g.id, user_id: user.id }, { $set: { active: false } });
      }
      const rate = weeklyRateFor(goal);
      const weeks = Math.ceil(Math.abs(answers.weight_kg - answers.target_weight_kg) / Math.abs(rate));
      await goals.insertOne({
        id: newId(),
        user_id: user.id,
        active: true,
        goal,
        current_weight_kg: answers.weight_kg,
        target_weight_kg: answers.target_weight_kg,
        weekly_rate_kg: rate,
        target_date: addDays(today, weeks * 7),
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
