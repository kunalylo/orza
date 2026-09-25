import { col } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { mediaUrl } from "@/lib/media";
import { activeMedications, doseLogId, dosesBetween, tzOf } from "@/lib/care/meds";
import { occurrencesBetween } from "@/lib/care/schedule";
import { isQuietNow } from "@/lib/care/integrations";
import {
  KIND_DEFAULT_BODY,
  REMINDER_URL,
  TIMING_TEXT,
  alarmUrl,
  doseLine,
  medicineLabel,
  type DueAlarm,
  type DueAlarmsResponse,
} from "@/components/care/reminders/shared";
import { utcToZoned } from "@/lib/dates";
import type { DoseLog, Medication, Reminder } from "@/lib/types";

export const dynamic = "force-dynamic";

/** How far back the in-app alarm still shows an unacted dose / reminder. */
const LOOKBACK_MIN = 30;
const MAX_ALARMS = 20;

function medicationAlarm(med: Medication, scheduledFor: string, localTime: string, snoozeUntil?: string): DueAlarm {
  const id = doseLogId(med.id, scheduledFor);
  return {
    kind: "medication",
    id,
    key: snoozeUntil ? `${id}@${snoozeUntil}` : id,
    title: `Time for ${medicineLabel(med)}`,
    body: doseLine(med) || med.dose,
    photo_urls: (med.photo_ids || []).map((p) => mediaUrl(p)),
    scheduled_for: scheduledFor,
    local_time: localTime,
    url: alarmUrl(med.id, scheduledFor),
    medication_id: med.id,
    name: med.name,
    strength: med.strength,
    dose: med.dose,
    timing_text: TIMING_TEXT[med.timing] || "",
    instructions: med.instructions,
    for_person: med.for_person,
    snoozed: !!snoozeUntil,
  };
}

/**
 * GET /api/alarms/due → {alarms, quiet, server_time}
 * Medicine doses and reminders due in the last 30 minutes that haven't been acted on, for the in-app
 * full-screen alarm (<AlarmWatcher />). Snoozed doses come back when their snooze ends, with a new `key`.
 */
export const GET = route(async () => {
  const user = await requireUser();
  const now = new Date();
  const tz = tzOf(user);
  const windowStart = new Date(now.getTime() - LOOKBACK_MIN * 60000);
  const from = new Date(windowStart.getTime() + 1);
  const to = new Date(now.getTime() + 1);
  const alarms: DueAlarm[] = [];

  const meds = (await activeMedications(user.id)).filter((m) => !m.as_needed);
  if (meds.length) {
    const byId = new Map(meds.map((m) => [m.id, m]));
    const seen = new Set<string>();
    // Snoozed doses whose snooze has ended.
    const snoozed = await col<DoseLog>("dose_logs").find({
      user_id: user.id,
      status: "snoozed",
      snooze_until: { $gt: windowStart.toISOString(), $lte: now.toISOString() },
    });
    for (const log of snoozed) {
      const med = byId.get(log.medication_id);
      if (!med || !log.snooze_until) continue;
      seen.add(log.id);
      alarms.push(medicationAlarm(med, log.scheduled_for, log.local_time, log.snooze_until));
    }
    // Scheduled doses nobody has acted on yet.
    for (const d of await dosesBetween(user, from, to, now, meds)) {
      if (d.status !== "due" || d.acted_at) continue;
      const med = byId.get(d.medication_id);
      const id = doseLogId(d.medication_id, d.scheduled_for);
      if (!med || seen.has(id)) continue;
      alarms.push(medicationAlarm(med, d.scheduled_for, d.local_time));
    }
  }

  if (user.preferences?.reminders !== false) {
    const reminders = await col<Reminder>("reminders").find({ user_id: user.id, active: true });
    for (const r of reminders) {
      if (!r.channels?.push) continue; // the in-app alarm follows the "app notification" channel
      for (const o of occurrencesBetween(r.schedule, from, to, tz)) {
        const id = `${r.id}:${o.iso}`;
        alarms.push({
          kind: "reminder",
          id,
          key: id,
          title: r.title,
          body: r.body?.trim() || KIND_DEFAULT_BODY[r.kind] || KIND_DEFAULT_BODY.custom,
          photo_urls: [],
          scheduled_for: o.iso,
          local_time: o.local_time || utcToZoned(o.at, tz).time,
          url: REMINDER_URL[r.kind] || REMINDER_URL.custom,
          reminder_id: r.id,
          reminder_kind: r.kind,
        });
      }
    }
  }

  // Medicines first, then oldest first.
  alarms.sort(
    (a, b) => Number(a.kind !== "medication") - Number(b.kind !== "medication") || a.scheduled_for.localeCompare(b.scheduled_for) || a.title.localeCompare(b.title)
  );
  const body: DueAlarmsResponse = { alarms: alarms.slice(0, MAX_ALARMS), quiet: isQuietNow(user, now), server_time: now.toISOString() };
  return json(body, { headers: { "Cache-Control": "no-store" } });
});
