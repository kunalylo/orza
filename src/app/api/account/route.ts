import { z } from "zod";
import { endSession, requireUser, revokeAllSessions } from "@/lib/auth";
import { col, type CollectionName } from "@/lib/db";
import { json, parseBody, route } from "@/lib/http";
import { CREDIT_REQUEST_TYPE, LEGACY_CREDIT_REQUEST_SOURCE } from "../credits/requests";

export const dynamic = "force-dynamic";

const Body = z.object({
  confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type DELETE to confirm' }) }),
});

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
  // Care: medicines, prescriptions, dose history, reminders, notification devices, sent alerts, health data, photos.
  "medications",
  "prescriptions",
  "dose_logs",
  "reminders",
  "push_subscriptions",
  "dispatches",
  "health_days",
  "media",
  // Phones running the ÖRZA app (their app sessions are revoked below).
  "devices",
];

/**
 * DELETE /api/account {confirm:"DELETE"} → {ok:true}
 * Permanently deletes the signed-in user and all of their data (including credit requests they sent,
 * registered phones and every signed-in session on other browsers and phones), then ends this session.
 * Data goes first and the user record last, so a failure part-way can simply be retried.
 */
export const DELETE = route(async (req: Request) => {
  const user = await requireUser();
  await parseBody(req, Body);

  const removed: Record<string, number> = {};
  for (const name of USER_DATA) {
    removed[name] = await col<{ id: string }>(name).deleteMany({ user_id: user.id });
  }
  // "Request more credits" messages sent from the account (stored in `leads`, tied by user_id)…
  removed.credit_requests = await col<{ id: string }>("leads").deleteMany({ type: CREDIT_REQUEST_TYPE, user_id: user.id });
  // …and older ones from before sign-in was required, which were stored under the account email.
  removed.legacy_credit_requests = await col<{ id: string }>("leads").deleteMany({
    email: (user.email || "").toLowerCase(),
    source: LEGACY_CREDIT_REQUEST_SOURCE,
  });
  await col<{ id: string }>("users").deleteOne({ id: user.id });
  // Sign out this browser and every other device: revoke all of the account's sessions, then clear the cookies.
  removed.sessions = await revokeAllSessions(user.id);
  await endSession();

  console.info("[orza] account deleted", { user_id: user.id, removed });
  return json({ ok: true });
});
