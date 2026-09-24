import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { progressOf, promptFor } from "@/lib/onboarding";
import { loadState, saveState, statePayload } from "../_store";

export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/restart → clears answers and returns the fresh state
 * (same shape as GET — `{step, answers, done, prompt, history, progress}` — plus `reply`, `input`, `options`).
 */
export const POST = route(async () => {
  const user = await requireUser();
  // A finished user keeps their saved answers; the payload just reports `done: true`.
  if (user.onboarding_complete) {
    return json({ ok: true, ...statePayload(user, await loadState(user)), reply: "", input: "none" });
  }
  await saveState(user.id, "goal", {});
  const prompt = promptFor("goal", {}, { name: user.name, ack: "No problem — let's start fresh.", intro: false });
  return json({
    ok: true,
    step: prompt.step,
    answers: {},
    done: false,
    prompt,
    history: [],
    progress: progressOf("goal", {}),
    reply: prompt.message,
    input: prompt.input,
    options: prompt.options,
  });
});
