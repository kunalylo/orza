import { z } from "zod";
import { requireUser, toPublicUser } from "@/lib/auth";
import { json, parseBody, route } from "@/lib/http";
import {
  ackFor,
  applyAnswer,
  conversationFor,
  isQuestionStep,
  nextStep,
  parseSummaryDecision,
  progressOf,
  promptFor,
} from "@/lib/onboarding";
import { completeOnboarding, loadState, saveState, stepResponse } from "../_store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  step: z.string().trim().min(1).max(40),
  answer: z.union([
    z.string().max(500, "Please keep your answer under 500 characters"),
    z.number().finite(),
    z.array(z.string().max(80)).max(20),
  ]),
});

/**
 * POST /api/onboarding/step {answer, step}
 * → {reply, step, options?, input, done, user?, prompt, progress, valid}
 * Invalid answers keep the user on the same step (`valid:false`, reply = friendly hint).
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { step, answer } = await parseBody(req, bodySchema);

  if (user.onboarding_complete) {
    return json({
      reply: "You're already set up — taking you to your dashboard.",
      step: "complete",
      input: "none",
      done: true,
      user: toPublicUser(user),
      progress: { index: 1, total: 1, value: 1 },
      valid: true,
    });
  }

  const state = await loadState(user);
  const { answers } = state;
  const name = user.name;

  // Stale tab / double submit: resync the client to where we actually are.
  if (step !== state.step || !isQuestionStep(state.step)) {
    const { history } = conversationFor(state.step, answers, name);
    const prompt = promptFor(state.step, answers, { name, ack: "Let's pick up where we left off." });
    return json(stepResponse(prompt, answers, { history, resync: true }));
  }

  if (state.step === "summary") {
    const decision = parseSummaryDecision(answer);
    if (decision === "restart") {
      await saveState(user.id, "goal", {});
      const prompt = promptFor("goal", {}, { name, ack: "No problem — let's start fresh.", intro: false });
      return json(stepResponse(prompt, {}, { restarted: true }));
    }
    if (decision !== "confirm") {
      const prompt = promptFor("summary", answers, { name });
      const error = "Tap “Looks good” to save your plan, or “Start over” to change your answers.";
      return json({ ...stepResponse({ ...prompt, message: error }, answers), valid: false, error });
    }
    const done = await completeOnboarding(user, answers);
    return json({
      reply: done.reply,
      step: "complete",
      input: "none",
      done: true,
      user: done.user,
      prompt: promptFor("complete", answers, { name }),
      progress: progressOf("complete", answers),
      answers,
      valid: true,
    });
  }

  const result = applyAnswer(state.step, answer, answers);
  if (!result.ok) {
    const prompt = promptFor(state.step, answers, { name });
    return json({ ...stepResponse({ ...prompt, message: result.error }, answers), valid: false, error: result.error });
  }

  const next = nextStep(state.step, result.answers);
  await saveState(user.id, next, result.answers);
  const prompt = promptFor(next, result.answers, { name, ack: ackFor(state.step, result.answers) });
  return json(stepResponse(prompt, result.answers));
});
