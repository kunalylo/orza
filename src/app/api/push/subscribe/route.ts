import { z } from "zod";
import { col, newId, nowISO } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, badRequest, json, parseBody, route } from "@/lib/http";
import { MAX_SUBSCRIPTIONS_PER_USER, isAllowedPushEndpoint, pushConfigured } from "@/lib/care/push";
import type { PushSubscriptionDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const base64url = z.string().trim().min(8).max(200).regex(/^[A-Za-z0-9_\-+/=]+$/, "Invalid key");

const body = z.object({
  endpoint: z.string().trim().url("Invalid push endpoint").max(1024),
  keys: z.object({ p256dh: base64url, auth: base64url }),
  expirationTime: z.number().nullable().optional(),
});

/**
 * POST /api/push/subscribe {endpoint, keys:{p256dh, auth}} → {ok, subscriptions}
 * Saves (or re-assigns) this browser's push subscription to the signed-in user. A browser can only
 * belong to one account at a time — the last account to subscribe on it receives its notifications.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  if (!pushConfigured()) throw new HttpError(503, "Notifications aren't set up on this ÖRZA server yet.", "push_not_configured");
  const input = await parseBody(req, body);
  if (!isAllowedPushEndpoint(input.endpoint)) throw badRequest("This browser's push service isn't supported.");

  const subs = col<PushSubscriptionDoc>("push_subscriptions");
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);
  await subs.updateOne(
    { endpoint: input.endpoint },
    {
      $set: { user_id: user.id, keys: { p256dh: input.keys.p256dh, auth: input.keys.auth }, user_agent: userAgent },
      $setOnInsert: { id: newId(), created_at: nowISO() },
    },
    { upsert: true }
  );

  // Keep the newest few devices per person.
  const mine = await subs.find({ user_id: user.id }, { sort: { created_at: -1 } });
  for (const old of mine.slice(MAX_SUBSCRIPTIONS_PER_USER)) {
    if (old.endpoint !== input.endpoint) await subs.deleteOne({ endpoint: old.endpoint, user_id: user.id });
  }
  const subscriptions = Math.min(mine.length, MAX_SUBSCRIPTIONS_PER_USER);
  return json({ ok: true, subscriptions });
});
