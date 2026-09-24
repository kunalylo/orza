import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { loadState, statePayload } from "./_store";

export const dynamic = "force-dynamic";

/** GET /api/onboarding → {step, answers, done, prompt, history, progress}. */
export const GET = route(async () => {
  const user = await requireUser();
  const state = await loadState(user);
  return json(statePayload(user, state), { headers: { "Cache-Control": "no-store" } });
});
