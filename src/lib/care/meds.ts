/**
 * Medication dose engine: expands schedules into doses, merges dose logs, and records actions.
 * Shared by the medicines UI, /api/meds/today, the in-app alarm, the push/WhatsApp dispatcher and the calendar feed.
 */
import { col, nowISO } from "@/lib/db";
import { DEFAULT_TZ, utcToZoned } from "@/lib/dates";
import { badRequest, notFound } from "@/lib/http";
import { mediaUrl } from "@/lib/media";
import { occurrencesBetween } from "@/lib/care/schedule";
import type { DoseLog, DoseStatus, Medication, User } from "@/lib/types";

/** Minutes after the scheduled time before an unacted dose counts as missed. */
export const MISSED_AFTER_MIN = 60;

export type DoseViewStatus = "upcoming" | "due" | "taken" | "skipped" | "snoozed" | "missed";

export interface DoseView {
  medication_id: string;
  name: string;
  strength?: string;
  dose: string;
  form: Medication["form"];
  timing: Medication["timing"];
  instructions?: string;
  for_person?: string;
  photo_ids: string[];
  photo_urls: string[];
  scheduled_for: string; // ISO UTC
  local_date: string;
  local_time: string;
  status: DoseViewStatus;
  snooze_until?: string;
  acted_at?: string;
}

export type MedicationClient = Medication & { photo_urls: string[] };

export const tzOf = (user: Pick<User, "profile">) => user.profile?.timezone || DEFAULT_TZ;

/** Medication as sent to the owner's browser (adds owner-only photo URLs). */
export function medicationToClient(m: Medication): MedicationClient {
  return { ...m, photo_urls: (m.photo_ids || []).map((id) => mediaUrl(id)) };
}

export function doseLogId(medicationId: string, scheduledFor: string) {
  return `${medicationId}:${scheduledFor}`;
}

/** Status of one scheduled dose at `now`. */
export function doseStatus(at: Date, log: DoseLog | undefined, now: Date = new Date()): DoseViewStatus {
  if (log?.status === "taken" || log?.status === "skipped") return log.status;
  if (log?.status === "snoozed" && log.snooze_until) {
    return new Date(log.snooze_until) > now ? "snoozed" : "due";
  }
  if (at > now) return "upcoming";
  return now.getTime() - at.getTime() <= MISSED_AFTER_MIN * 60000 ? "due" : "missed";
}

export async function activeMedications(userId: string): Promise<Medication[]> {
  return col<Medication>("medications").find({ user_id: userId, active: true }, { sort: { created_at: 1 } });
}

/**
 * All scheduled doses of the user's active, non-SOS medicines with `from <= at < to`,
 * merged with their dose logs. Sorted by time.
 */
export async function dosesBetween(user: User, from: Date, to: Date, now: Date = new Date(), meds?: Medication[]): Promise<DoseView[]> {
  const tz = tzOf(user);
  const list = (meds || (await activeMedications(user.id))).filter((m) => m.active && !m.as_needed);
  if (!list.length) return [];
  // Doses scheduled well before the medicine was added (e.g. this morning's 08:00 for a medicine added at 16:00)
  // were never the user's to take in ÖRZA — don't list them as missed. 30 min grace covers "adding the one I take now".
  const occ = list.flatMap((m) => {
    const since = Date.parse(m.created_at) - 30 * 60000;
    return occurrencesBetween(m.schedule, from, to, tz)
      .filter((o) => !Number.isFinite(since) || o.at.getTime() >= since)
      .map((o) => ({ m, o }));
  });
  if (!occ.length) return [];
  const logs = await col<DoseLog>("dose_logs").find({
    user_id: user.id,
    id: { $in: occ.map(({ m, o }) => doseLogId(m.id, o.iso)) },
  });
  const byId = new Map(logs.map((l) => [l.id, l]));
  return occ
    .map(({ m, o }) => {
      const log = byId.get(doseLogId(m.id, o.iso));
      return {
        medication_id: m.id,
        name: m.name,
        strength: m.strength,
        dose: m.dose,
        form: m.form,
        timing: m.timing,
        instructions: m.instructions,
        for_person: m.for_person,
        photo_ids: m.photo_ids || [],
        photo_urls: (m.photo_ids || []).map((id) => mediaUrl(id)),
        scheduled_for: o.iso,
        local_date: o.local_date,
        local_time: o.local_time,
        status: doseStatus(o.at, log, now),
        snooze_until: log?.snooze_until,
        acted_at: log?.acted_at,
      } satisfies DoseView;
    })
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.name.localeCompare(b.name));
}

/** Doses on the user's local calendar day `date` (YYYY-MM-DD). */
export async function dosesForLocalDay(user: User, date: string, now: Date = new Date()): Promise<DoseView[]> {
  const tz = tzOf(user);
  // Window wide enough to cover any UTC offset; filter to the local date afterwards.
  const [y, m, d] = date.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d) - 15 * 3600000);
  const to = new Date(Date.UTC(y, m - 1, d) + 39 * 3600000);
  return (await dosesBetween(user, from, to, now)).filter((x) => x.local_date === date && utcToZoned(new Date(x.scheduled_for), tz).date === date);
}

/**
 * Record Take / Skip / Snooze for one scheduled dose. Validates ownership and that `scheduledFor`
 * is a real occurrence of the medicine's schedule (±36 h window) so arbitrary logs can't be written.
 * "take" decrements stock once (not again if the dose was already taken).
 */
export async function recordDoseAction(
  user: User,
  medicationId: string,
  scheduledFor: string,
  action: "take" | "skip" | "snooze",
  snoozeMinutes = 10
): Promise<DoseLog> {
  const med = await col<Medication>("medications").findOne({ id: medicationId, user_id: user.id });
  if (!med) throw notFound("Medicine not found");
  const at = new Date(scheduledFor);
  if (Number.isNaN(at.getTime())) throw badRequest("Invalid dose time");
  const tz = tzOf(user);
  const window = occurrencesBetween(med.schedule, new Date(at.getTime() - 36 * 3600000), new Date(at.getTime() + 36 * 3600000), tz);
  const occ = window.find((o) => o.at.getTime() === at.getTime());
  if (!occ || med.as_needed) throw badRequest("That dose isn't on this medicine's schedule");

  const id = doseLogId(med.id, occ.iso);
  const logs = col<DoseLog>("dose_logs");
  const prev = await logs.findOne({ id, user_id: user.id });
  const status: DoseStatus = action === "take" ? "taken" : action === "skip" ? "skipped" : "snoozed";
  const now = new Date();
  const minutes = Math.min(60, Math.max(5, Math.round(snoozeMinutes)));
  const set: Partial<DoseLog> = {
    status,
    acted_at: now.toISOString(),
    snooze_until: action === "snooze" ? new Date(now.getTime() + minutes * 60000).toISOString() : undefined,
  };
  const log = await logs.findOneAndUpdate(
    { id, user_id: user.id },
    {
      $set: Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined)),
      ...(action !== "snooze" && prev?.snooze_until ? { $unset: { snooze_until: 1 } } : {}),
      $setOnInsert: {
        medication_id: med.id,
        scheduled_for: occ.iso,
        local_date: occ.local_date,
        local_time: occ.local_time,
        created_at: nowISO(),
      },
    },
    { upsert: true }
  );

  if (action === "take" && prev?.status !== "taken" && med.stock && typeof med.stock.count === "number" && med.stock.count > 0) {
    await col<Medication>("medications").updateOne({ id: med.id, user_id: user.id }, { $inc: { "stock.count": -1 }, $set: { updated_at: nowISO() } });
  }
  return log as DoseLog;
}
