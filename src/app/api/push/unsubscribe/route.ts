import { z } from "zod";
import { col } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, parseBody, route } from "@/lib/http";
import type { PushSubscriptionDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const body = z.object({ endpoint: z.string().trim().min(1, "Missing endpoint").max(1024) });

/** POST /api/push/unsubscribe {endpoint} → {ok, subscriptions} (only the caller's own subscription can be removed). */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { endpoint } = await parseBody(req, body);
  const subs = col<PushSubscriptionDoc>("push_subscriptions");
  await subs.deleteOne({ endpoint, user_id: user.id });
  const subscriptions = await subs.countDocuments({ user_id: user.id });
  return json({ ok: true, subscriptions });
});
