import { requireUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { json, notFound, parseBody, route } from "@/lib/http";
import { withScheduleVersion } from "@/lib/care/meds";
import { sameSchedule } from "@/lib/care/schedule";
import type { DoseLog, Medication, Schedule } from "@/lib/types";
import { blankToUndef, buildSchedule, deletePhotosIfUnused, medicationPatchSchema, medicationToClientFor, stockFrom } from "../_shared";

type Ctx = { params: Promise<{ id: string }> };

async function ownMedication(userId: string, id: string) {
  const med = await col<Medication>("medications").findOne({ id, user_id: userId });
  if (!med) throw notFound("Medicine not found");
  return med;
}

/** GET /api/meds/[id] → { medication } */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return json({ medication: await medicationToClientFor(user.id, await ownMedication(user.id, id)) });
});

/**
 * PATCH /api/meds/[id] (partial) → { medication }. `null` clears optional fields; `schedule` may be partial.
 * A change of schedule, `active` or `as_needed` keeps the replaced version in `schedule_history` (for adherence).
 */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const med = await ownMedication(user.id, id);
  const body = await parseBody(req, medicationPatchSchema);

  const now = nowISO();
  const set: Record<string, unknown> = { updated_at: now };
  const unset: Record<string, 1> = {};
  const optional = (key: "strength" | "instructions" | "for_person", v: string | null | undefined) => {
    if (v === undefined) return;
    const clean = blankToUndef(v);
    if (clean) set[key] = clean;
    else unset[key] = 1;
  };

  if (body.name !== undefined) set.name = body.name;
  if (body.form !== undefined) set.form = body.form;
  if (body.dose !== undefined) set.dose = body.dose;
  if (body.timing !== undefined) set.timing = body.timing;
  if (body.active !== undefined) set.active = body.active;
  optional("strength", body.strength);
  optional("instructions", body.instructions);
  optional("for_person", body.for_person);

  if (body.stock !== undefined) {
    const stock = stockFrom(body.stock);
    if (stock) set.stock = stock;
    else unset.stock = 1;
  }

  const asNeeded = body.as_needed ?? med.as_needed;
  if (body.as_needed !== undefined) set.as_needed = body.as_needed;
  if (body.schedule || body.as_needed !== undefined) {
    const s = body.schedule || {};
    set.schedule = buildSchedule(
      {
        times: s.times ?? med.schedule.times,
        days: s.days ?? med.schedule.days,
        start_date: s.start_date ?? med.schedule.start_date,
        end_date: s.end_date === null ? undefined : (s.end_date ?? med.schedule.end_date),
        every_n_days: s.every_n_days === null ? undefined : (s.every_n_days ?? med.schedule.every_n_days),
      },
      asNeeded
    );
  }

  if (body.primary_photo_id) {
    if (!med.photo_ids.includes(body.primary_photo_id)) throw notFound("Photo not found");
    set.photo_ids = [body.primary_photo_id, ...med.photo_ids.filter((p) => p !== body.primary_photo_id)];
  }

  // Past days keep the schedule they had: adherence rebuilds them from this history.
  const schedule = (set.schedule as Schedule | undefined) ?? med.schedule;
  if (!sameSchedule(schedule, med.schedule) || (body.active ?? med.active) !== med.active || asNeeded !== med.as_needed) {
    set.schedule_history = withScheduleVersion(med, now);
  }

  const updated = await col<Medication>("medications").findOneAndUpdate(
    { id: med.id, user_id: user.id },
    Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set }
  );
  if (!updated) throw notFound("Medicine not found");
  return json({ medication: await medicationToClientFor(user.id, updated) });
});

/** DELETE /api/meds/[id] → { ok } — also deletes its dose history and any photos nothing else uses. */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const med = await ownMedication(user.id, id);
  await col<Medication>("medications").deleteOne({ id: med.id, user_id: user.id });
  await col<DoseLog>("dose_logs").deleteMany({ user_id: user.id, medication_id: med.id });
  await deletePhotosIfUnused(user.id, med.photo_ids || []);
  return json({ ok: true });
});
