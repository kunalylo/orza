import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { daysBetween } from "@/lib/dates";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { actedDosesForLocalDays, dosesBetween, recordDoseAction } from "@/lib/care/meds";
import { doseToClient, isRealDate } from "../_shared";

/** Client-sent instants are optional extras: anything unusable is ignored rather than refusing the dose action. */
const clientInstant = z.string().max(64).optional().catch(undefined);

const actionSchema = z.object({
  medication_id: z.string().trim().min(1).max(64),
  scheduled_for: z.string().trim().min(10).max(40),
  action: z.enum(["take", "skip", "snooze"]),
  snooze_minutes: z.number().int().min(5).max(60).optional(),
  /** Absolute snooze end (ISO with zone); wins over snooze_minutes; clamped to now + 1 … 60 min. */
  snooze_until: clientInstant,
  /** When the button was pressed (ISO with zone); clamped to [scheduled_for − 36 h, now]. */
  acted_at: clientInstant,
  /** Skip / Snooze a dose already marked as taken (a deliberate correction). Without it that's a 409. */
  override: z.boolean().optional(),
});

/** Most local days one `?from=&to=` request may span. */
const MAX_RANGE_DAYS = 14;

/**
 * POST /api/meds/doses {medication_id, scheduled_for, action: "take"|"skip"|"snooze", snooze_minutes?: 5–60,
 *   snooze_until?: iso, acted_at?: iso, override?: boolean} → { dose }
 * Upserts the dose log `${medication_id}:${scheduled_for}`; "take" decrements stock once. `acted_at` (when the
 * button was pressed — e.g. offline) is stored clamped to [scheduled_for − 36 h, now]; absent / unparsable → now.
 * A snooze ends at `snooze_until` (clamped to now + 1 … 60 min) or now + snooze_minutes (default 10).
 * Skip / Snooze over a dose already taken → 409 `dose_already_taken` unless `override: true`.
 * Also used by the service worker's notification actions.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, actionSchema);
  const dose = await recordDoseAction(user, body.medication_id, body.scheduled_for, body.action, {
    snoozeMinutes: body.snooze_minutes,
    snoozeUntil: body.snooze_until,
    actedAt: body.acted_at,
    override: body.override,
  });
  return json({ dose });
});

const HOUR = 3600000;

/**
 * GET /api/meds/doses?at=<iso> → { now, doses } — every dose scheduled at that instant (the alarm screen).
 * GET /api/meds/doses?from=YYYY-MM-DD&to=YYYY-MM-DD → { from, to, now, doses } — the recorded Take / Skip / Snooze
 * logs for doses on those local days (user's timezone, inclusive, at most 14 days): [{medication_id, scheduled_for,
 * local_date, local_time, status: "taken"|"skipped"|"snoozed", acted_at?, snooze_until?}], sorted by time.
 * GET /api/meds/doses → { now, doses, next } — doses due right now (last 12 h, unacted or snooze over)
 * plus the next upcoming dose within 24 h.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const params = new URL(req.url).searchParams;
  const atParam = params.get("at");
  const now = new Date();

  if (atParam) {
    const at = new Date(atParam);
    if (Number.isNaN(at.getTime())) throw badRequest("Invalid dose time");
    const doses = await dosesBetween(user, new Date(at.getTime() - 30000), new Date(at.getTime() + 30000), now);
    return json({ now: now.toISOString(), doses: doses.map(doseToClient) });
  }

  const from = params.get("from");
  const to = params.get("to");
  if (from !== null || to !== null) {
    if (!isRealDate(from) || !isRealDate(to)) throw badRequest("Use from and to dates like 2026-09-24");
    if (to < from) throw badRequest("The to date can't be before the from date");
    if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) throw badRequest(`Ask for at most ${MAX_RANGE_DAYS} days at a time`);
    const doses = await actedDosesForLocalDays(user, from, to);
    return json({ from, to, now: now.toISOString(), doses });
  }

  const around = await dosesBetween(user, new Date(now.getTime() - 12 * HOUR), new Date(now.getTime() + 24 * HOUR), now);
  const due = around.filter((d) => d.status === "due");
  const next = around.find((d) => d.status === "upcoming") || null;
  return json({ now: now.toISOString(), doses: due.map(doseToClient), next: next ? doseToClient(next) : null });
});
