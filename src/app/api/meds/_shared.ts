/**
 * Validation + helpers shared by the /api/meds and /api/prescriptions routes (server only).
 */
import { z } from "zod";
import { col } from "@/lib/db";
import { isHHMM } from "@/lib/dates";
import { badRequest } from "@/lib/http";
import { deleteMedia } from "@/lib/media";
import { normalizeTimes } from "@/lib/care/schedule";
import { DOSE_TIMINGS, MED_FORMS } from "@/lib/care/prescription-ai";
import { medicationToClient, type DoseView } from "@/lib/care/meds";
import type { DoseTiming, Medication, MedForm, Prescription, Schedule } from "@/lib/types";

export const MAX_TIMES_PER_DAY = 12;
export const MAX_PHOTOS_ON_CREATE = 4;
export const MAX_PHOTOS_PER_MEDICINE = 6;
export const MAX_MEDICATIONS = 100;
/** A base64 data URL for a ≤1.5 MB image is ~2.0M characters; `saveImage` enforces the real limit. */
const MAX_DATA_URL_CHARS = 2_200_000;

export const isRealDate = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export const dateSchema = z.string().refine(isRealDate, "Use a date like 2026-09-30");
const timeSchema = z.string().refine(isHHMM, "Use 24-hour times like 08:00 or 21:30");
export const imageSchema = z.string().min(30, "Please attach a photo").max(MAX_DATA_URL_CHARS, "That photo is too large. Please use a smaller image (max 1.5 MB).");

export const formSchema = z.enum(MED_FORMS as unknown as [MedForm, ...MedForm[]]);
export const timingSchema = z.enum(DOSE_TIMINGS as unknown as [DoseTiming, ...DoseTiming[]]);

export const scheduleSchema = z.object({
  times: z.array(timeSchema).max(MAX_TIMES_PER_DAY, `At most ${MAX_TIMES_PER_DAY} times a day`),
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  start_date: dateSchema,
  end_date: dateSchema.nullable().optional(),
  every_n_days: z.number().int().min(1).max(90).nullable().optional(),
});
export type ScheduleInput = z.infer<typeof scheduleSchema>;

const optText = (max: number) => z.string().trim().max(max).nullable().optional();

export const stockSchema = z.object({
  count: z.number().int().min(0).max(10000),
  unit: z.string().trim().min(1).max(20).default("tablets"),
  refill_alert_at: z.number().int().min(0).max(1000).nullable().optional(),
});

export const medicationCreateSchema = z.object({
  name: z.string().trim().min(1, "Add the medicine's name").max(80),
  strength: optText(40),
  form: formSchema.default("tablet"),
  dose: z.string().trim().min(1, "Add the dose, e.g. 1 tablet").max(40),
  timing: timingSchema.default("any"),
  instructions: optText(300),
  schedule: scheduleSchema,
  as_needed: z.boolean().default(false),
  stock: stockSchema.nullable().optional(),
  for_person: optText(40),
  photos: z.array(imageSchema).max(MAX_PHOTOS_ON_CREATE, `Up to ${MAX_PHOTOS_ON_CREATE} photos when adding a medicine`).optional(),
});

export const medicationPatchSchema = z.object({
  name: z.string().trim().min(1, "Add the medicine's name").max(80).optional(),
  strength: optText(40),
  form: formSchema.optional(),
  dose: z.string().trim().min(1, "Add the dose, e.g. 1 tablet").max(40).optional(),
  timing: timingSchema.optional(),
  instructions: optText(300),
  schedule: scheduleSchema.partial().optional(),
  as_needed: z.boolean().optional(),
  active: z.boolean().optional(),
  stock: stockSchema.nullable().optional(),
  for_person: optText(40),
  /** Move this photo to the front — it becomes the one shown on alarms. */
  primary_photo_id: z.string().min(1).max(64).optional(),
});

/** Validated, normalised schedule. Throws 400 with a friendly message. */
export function buildSchedule(input: Partial<ScheduleInput> & { start_date: string; times: string[] }, asNeeded: boolean): Schedule {
  const times = normalizeTimes(input.times || []);
  if (times.length > MAX_TIMES_PER_DAY) throw badRequest(`A medicine can ring at most ${MAX_TIMES_PER_DAY} times a day.`);
  if (!asNeeded && !times.length) throw badRequest("Add at least one time so ÖRZA knows when to remind you.");
  if (!isRealDate(input.start_date)) throw badRequest("Choose a valid start date.");
  if (input.end_date && !isRealDate(input.end_date)) throw badRequest("Choose a valid end date.");
  if (input.end_date && input.end_date < input.start_date) throw badRequest("The end date can't be before the start date.");
  let days = [...new Set((input.days || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (days.length === 7) days = [];
  const schedule: Schedule = { times, days, start_date: input.start_date };
  if (input.end_date) schedule.end_date = input.end_date;
  const n = input.every_n_days ? Math.round(input.every_n_days) : 1;
  if (n > 1) schedule.every_n_days = Math.min(90, n);
  return schedule;
}

/** Empty / whitespace strings → undefined. */
export const blankToUndef = (s: string | null | undefined) => (typeof s === "string" && s.trim() ? s.trim() : undefined);

/** Drop undefined keys so documents stay clean in Mongo (no stored nulls). */
export function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export function stockFrom(input: z.infer<typeof stockSchema> | null | undefined): Medication["stock"] | undefined {
  if (!input) return undefined;
  return compact({ count: input.count, unit: input.unit || "tablets", refill_alert_at: input.refill_alert_at ?? undefined });
}

/**
 * Delete images that no other medicine and no prescription still uses. Prescription photos are
 * shared as fallback photos across every medicine created from them, so they must survive until
 * the last reference is gone.
 */
export async function deletePhotosIfUnused(userId: string, ids: string[]) {
  const unused: string[] = [];
  for (const id of [...new Set(ids)]) {
    const [byMeds, byRx] = await Promise.all([
      col<Medication>("medications").countDocuments({ user_id: userId, photo_ids: id }),
      col<Prescription>("prescriptions").countDocuments({ user_id: userId, media_id: id }),
    ]);
    if (!byMeds && !byRx) unused.push(id);
  }
  if (unused.length) await deleteMedia(userId, unused);
}

/**
 * `medicationToClient` plus `uses_prescription_photo`: true while a medicine created from a
 * prescription still shows only the prescription photo (the UI nudges the user to add a pill photo).
 */
export async function medicationsToClient(userId: string, list: Medication[]) {
  const rxIds = [...new Set(list.map((m) => m.prescription_id).filter((x): x is string => !!x))];
  const rxMedia = new Map<string, string | undefined>();
  if (rxIds.length) {
    const rxs = await col<Prescription>("prescriptions").find({ user_id: userId, id: { $in: rxIds } });
    for (const p of rxs) rxMedia.set(p.id, p.media_id);
  }
  return list.map((m) => {
    const rxPhoto = m.prescription_id ? rxMedia.get(m.prescription_id) : undefined;
    const ids = m.photo_ids || [];
    return { ...medicationToClient(m), uses_prescription_photo: !!rxPhoto && ids.length > 0 && ids.every((id) => id === rxPhoto) };
  });
}

export async function medicationToClientFor(userId: string, m: Medication) {
  return (await medicationsToClient(userId, [m]))[0];
}

/** One dose as sent to the browser (medicines page, alarm screen, Today card). */
export function doseToClient(d: DoseView) {
  return compact({
    medication_id: d.medication_id,
    name: d.name,
    strength: d.strength,
    dose: d.dose,
    timing: d.timing,
    form: d.form,
    instructions: d.instructions,
    photo_urls: d.photo_urls,
    scheduled_for: d.scheduled_for,
    local_date: d.local_date,
    local_time: d.local_time,
    status: d.status,
    snooze_until: d.snooze_until,
    acted_at: d.acted_at,
    for_person: d.for_person,
  });
}

/** Active medicines first, then alphabetical. */
export function sortMedications(list: Medication[]): Medication[] {
  return [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}
