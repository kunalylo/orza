import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { col, newId, nowISO } from "@/lib/db";
import { addDays, dateInTz } from "@/lib/dates";
import { badRequest, HttpError, json, notFound, parseBody, route } from "@/lib/http";
import { tzOf } from "@/lib/care/meds";
import { parseFrequency } from "@/lib/care/frequency";
import { MAX_PRESCRIPTION_MEDICINES, normaliseMedicines } from "@/lib/care/prescription-ai";
import type { Medication } from "@/lib/types";
import { blankToUndef, buildSchedule, compact, dateSchema, MAX_MEDICATIONS, medicationsToClient } from "../../../meds/_shared";
import { prescriptionToClient, type PrescriptionDoc } from "../../_shared";

type Ctx = { params: Promise<{ id: string }> };

const applySchema = z.object({
  /** The user-edited review table (only the rows they kept). */
  medicines: z.array(z.record(z.unknown())).min(1, "Choose at least one medicine").max(MAX_PRESCRIPTION_MEDICINES),
  start_date: dateSchema.optional(),
  /** Caregiver mode: who these medicines are for, e.g. "Mom". */
  for_person: z.string().trim().max(40).optional(),
});

/**
 * POST /api/prescriptions/[id]/apply {medicines, start_date?, for_person?} → { medications, prescription }
 * Creates one medicine per row with a schedule (times, repeat rule from the written frequency,
 * start date = the user's local today unless given, end date from duration_days). The prescription
 * photo is attached as each medicine's fallback photo until the user adds pill photos.
 */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await parseBody(req, applySchema);
  const rxs = col<PrescriptionDoc>("prescriptions");
  const rx = await rxs.findOne({ id, user_id: user.id });
  if (!rx) throw notFound("Prescription not found");
  if (rx.status === "applied") throw new HttpError(409, "Alarms were already created from this prescription.", "already_applied");

  const medicines = normaliseMedicines(body.medicines, { fromUser: true });
  if (!medicines.length) throw badRequest("Add at least one medicine with a name.");

  const meds = col<Medication>("medications");
  const existing = await meds.countDocuments({ user_id: user.id });
  if (existing + medicines.length > MAX_MEDICATIONS) {
    throw badRequest(`You can keep up to ${MAX_MEDICATIONS} medicines. Delete ones you no longer take to add these.`);
  }

  const start = body.start_date || dateInTz(tzOf(user));
  const forPerson = blankToUndef(body.for_person);
  const now = nowISO();
  const created: Medication[] = medicines.map((m) => {
    const parsed = parseFrequency(m.frequency_text);
    const schedule = buildSchedule(
      {
        times: m.as_needed ? m.times : m.times.length ? m.times : ["08:00"],
        days: parsed.days || [],
        start_date: start,
        end_date: m.duration_days ? addDays(start, m.duration_days - 1) : undefined,
        every_n_days: parsed.every_n_days,
      },
      m.as_needed
    );
    return compact({
      id: newId(),
      user_id: user.id,
      name: m.name,
      strength: m.strength,
      form: m.form,
      dose: m.dose,
      timing: m.timing,
      instructions: m.instructions,
      photo_ids: rx.media_id ? [rx.media_id] : [],
      schedule,
      as_needed: m.as_needed,
      active: true,
      prescription_id: rx.id,
      for_person: forPerson,
      created_at: now,
      updated_at: now,
    });
  });

  // Claim the prescription first so a double-tap can't create the medicines twice.
  const claimed = await rxs.findOneAndUpdate(
    { id: rx.id, user_id: user.id, status: "review" },
    { $set: { status: "applied", medicines, applied_medication_ids: created.map((m) => m.id), applied_at: now } }
  );
  if (!claimed) throw new HttpError(409, "Alarms were already created from this prescription.", "already_applied");

  const inserted: Medication[] = [];
  try {
    for (const m of created) inserted.push(await meds.insertOne(m));
  } catch (e) {
    for (const m of inserted) await meds.deleteOne({ id: m.id, user_id: user.id }).catch(() => 0);
    await rxs.updateOne({ id: rx.id, user_id: user.id }, { $set: { status: "review" }, $unset: { applied_medication_ids: 1, applied_at: 1 } }).catch(() => undefined);
    throw e;
  }

  return json({ medications: await medicationsToClient(user.id, created), prescription: prescriptionToClient(claimed) });
});
