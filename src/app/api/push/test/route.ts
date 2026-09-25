import { z } from "zod";
import { col } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, badRequest, json, parseBody, route } from "@/lib/http";
import { mediaUrl } from "@/lib/media";
import { listSubscriptions, pushConfigured, sendPushToSubscriptions, type PushPayload } from "@/lib/care/push";
import { cooldownSeconds } from "@/lib/care/integrations";
import { medicineLabel } from "@/components/care/reminders/shared";
import type { Medication } from "@/lib/types";

export const dynamic = "force-dynamic";

const body = z.object({ endpoint: z.string().trim().max(1024).optional() });

/**
 * POST /api/push/test {endpoint?} → {sent, failed, errors}
 * Sends a sample notification — to this browser only when `endpoint` is given, else to every device.
 * Uses a medicine photo when the user has one, so they see exactly what an alarm looks like.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  if (!pushConfigured()) throw new HttpError(503, "Notifications aren't set up on this ÖRZA server yet.", "push_not_configured");
  const { endpoint } = await parseBody(req, body);

  const all = await listSubscriptions(user.id);
  const targets = endpoint ? all.filter((s) => s.endpoint === endpoint) : all;
  if (!targets.length) {
    throw badRequest(endpoint ? "This browser isn't subscribed yet. Turn on notifications first." : "No device has notifications turned on yet.");
  }
  const wait = cooldownSeconds(`push-test:${user.id}`, 15_000);
  if (wait) throw new HttpError(429, `Please wait ${wait} s before sending another test.`, "rate_limited");

  const meds = await col<Medication>("medications").find({ user_id: user.id, active: true }, { sort: { created_at: 1 } });
  const med = meds.find((m) => m.photo_ids?.length);
  const photo = med ? mediaUrl(med.photo_ids[0], 3600) : undefined;
  const payload: PushPayload = med
    ? {
        title: `💊 Test alarm · ${medicineLabel(med)}`,
        body: `${med.dose ? `${med.dose} · ` : ""}This is how medicine alarms will look, photo included.`,
        image: photo,
        icon: photo,
        tag: "orza-test",
        renotify: true,
        vibrate: [300, 150, 300],
        data: { url: "/dashboard/reminders", kind: "test" },
      }
    : {
        title: "🔔 ÖRZA notifications are on",
        body: "This is how your reminders will arrive. Add a medicine photo to see it on alarms too.",
        tag: "orza-test",
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: "/dashboard/reminders", kind: "test" },
      };

  const r = await sendPushToSubscriptions(targets, payload, { ttl: 300, urgency: "high" });
  return json({ sent: r.sent, failed: r.failed, removed: r.removed.length, errors: r.errors.slice(0, 3) });
});
