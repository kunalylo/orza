import { z } from "zod";
import { endSession, requireUser } from "@/lib/auth";
import { col, type CollectionName } from "@/lib/db";
import { json, parseBody, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const Body = z.object({
  confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type DELETE to confirm' }) }),
});

/** Lead source used by the Credits page's "Request more credits" dialog. */
const CREDIT_REQUEST_SOURCE = "credits-request";

/** Collections whose documents carry `user_id`. The user record itself is removed last. */
const USER_DATA: CollectionName[] = [
  "meals",
  "scans",
  "tracking",
  "chat_messages",
  "chat_sessions",
  "goals",
  "compensation_plans",
  "recipes",
  "credit_transactions",
  "onboarding",
];

/**
 * DELETE /api/account {confirm:"DELETE"} → {ok:true}
 * Permanently deletes the signed-in user and all of their data (including credit requests they sent), then ends the session.
 * Data goes first and the user record last, so a failure part-way can simply be retried.
 */
export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  await parseBody(req, Body);

  const removed: Record<string, number> = {};
  for (const name of USER_DATA) {
    removed[name] = await col<{ id: string }>(name).deleteMany({ user_id: user.id });
  }
  // "Request more credits" messages sent from inside the account (stored as leads by email).
  removed.credit_requests = await col<{ id: string }>("leads").deleteMany({
    email: (user.email || "").toLowerCase(),
    source: CREDIT_REQUEST_SOURCE,
  });
  await col<{ id: string }>("users").deleteOne({ id: user.id });
  await endSession();

  console.info("[orza] account deleted", { user_id: user.id, removed });
  return json({ ok: true });
});
