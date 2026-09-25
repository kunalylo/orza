import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { dosesBetween, recordDoseAction } from "@/lib/care/meds";
import { doseToClient } from "../_shared";

const actionSchema = z.object({
  medication_id: z.string().trim().min(1).max(64),
  scheduled_for: z.string().trim().min(10).max(40),
  action: z.enum(["take", "skip", "snooze"]),
  snooze_minutes: z.number().int().min(5).max(60).optional(),
});

/**
 * POST /api/meds/doses {medication_id, scheduled_for, action: "take"|"skip"|"snooze", snooze_minutes?: 5–60} → { dose }
 * Upserts the dose log `${medication_id}:${scheduled_for}`; "take" decrements stock once. Also used by the
 * service worker's notification actions.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, actionSchema);
  const dose = await recordDoseAction(user, body.medication_id, body.scheduled_for, body.action, body.snooze_minutes ?? 10);
  return json({ dose });
});

const HOUR = 3600000;

/**
 * GET /api/meds/doses?at=<iso> → { now, doses } — every dose scheduled at that instant (the alarm screen).
 * GET /api/meds/doses → { now, doses, next } — doses due right now (last 12 h, unacted or snooze over)
 * plus the next upcoming dose within 24 h.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const atParam = new URL(req.url).searchParams.get("at");
  const now = new Date();

  if (atParam) {
    const at = new Date(atParam);
    if (Number.isNaN(at.getTime())) throw badRequest("Invalid dose time");
    const doses = await dosesBetween(user, new Date(at.getTime() - 30000), new Date(at.getTime() + 30000), now);
    return json({ now: now.toISOString(), doses: doses.map(doseToClient) });
  }

  const around = await dosesBetween(user, new Date(now.getTime() - 12 * HOUR), new Date(now.getTime() + 24 * HOUR), now);
  const due = around.filter((d) => d.status === "due");
  const next = around.find((d) => d.status === "upcoming") || null;
  return json({ now: now.toISOString(), doses: due.map(doseToClient), next: next ? doseToClient(next) : null });
});
