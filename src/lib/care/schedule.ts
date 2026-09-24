/**
 * Schedule engine shared by medicines, reminders, the alarm dispatcher, the in-app alarm watcher
 * and the ICS calendar feed. Everything is computed in the user's timezone (profile.timezone).
 */
import { addDays, daysBetween, DEFAULT_TZ, utcToZoned, zonedToUtc } from "@/lib/dates";
import type { Schedule } from "@/lib/types";

export interface Occurrence {
  at: Date; // UTC instant
  iso: string; // at.toISOString()
  local_date: string; // YYYY-MM-DD
  local_time: string; // HH:MM
}

/** Is `schedule` active on local calendar day `date`? */
export function activeOnDate(schedule: Schedule, date: string): boolean {
  if (date < schedule.start_date) return false;
  if (schedule.end_date && date > schedule.end_date) return false;
  const n = Math.max(1, Math.floor(schedule.every_n_days || 1));
  if (n > 1 && daysBetween(schedule.start_date, date) % n !== 0) return false;
  if (schedule.days?.length) {
    const [y, m, d] = date.split("-").map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (!schedule.days.includes(weekday)) return false;
  }
  return true;
}

/** Occurrences of `schedule` on local day `date` (sorted by time). */
export function occurrencesOnDate(schedule: Schedule, date: string, tz: string = DEFAULT_TZ): Occurrence[] {
  if (!activeOnDate(schedule, date)) return [];
  return [...new Set(schedule.times)]
    .sort()
    .map((time) => {
      const at = zonedToUtc(date, time, tz);
      return { at, iso: at.toISOString(), local_date: date, local_time: time };
    });
}

/** All occurrences with `from <= at < to` (UTC instants). Scans the local days that overlap the window. */
export function occurrencesBetween(schedule: Schedule, from: Date, to: Date, tz: string = DEFAULT_TZ): Occurrence[] {
  if (to <= from) return [];
  const first = addDays(utcToZoned(from, tz).date, -1);
  const last = addDays(utcToZoned(to, tz).date, 1);
  const span = Math.min(daysBetween(first, last), 400); // hard cap
  const out: Occurrence[] = [];
  for (let i = 0; i <= span; i++) {
    for (const o of occurrencesOnDate(schedule, addDays(first, i), tz)) {
      if (o.at >= from && o.at < to) out.push(o);
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Next occurrence strictly after `after`, looking ahead up to `maxDays`. */
export function nextOccurrence(schedule: Schedule, after: Date, tz: string = DEFAULT_TZ, maxDays = 60): Occurrence | null {
  const to = new Date(after.getTime() + maxDays * 86400000);
  return occurrencesBetween(schedule, new Date(after.getTime() + 1), to, tz)[0] || null;
}

/** Sort + dedupe + validate "HH:MM" strings. */
export function normalizeTimes(times: string[]): string[] {
  return [...new Set(times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))].sort();
}

/**
 * Default clock times for common Indian prescription patterns, e.g. "1-0-1" → ["08:00","20:00"].
 * Slots are morning / afternoon / night (a 4-slot "1-1-1-1" adds evening).
 */
export const DEFAULT_SLOT_TIMES = { morning: "08:00", afternoon: "14:00", evening: "18:00", night: "21:00", bedtime: "22:00" } as const;

export function timesForPattern(pattern: string): string[] | null {
  const p = pattern.trim().toUpperCase().replace(/\s+/g, "");
  const dash = p.match(/^([0-9½.]+)-([0-9½.]+)-([0-9½.]+)(?:-([0-9½.]+))?$/);
  if (dash) {
    const on = (v?: string) => !!v && v !== "0";
    const [, a, b, c, d] = dash;
    if (d !== undefined) {
      return normalizeTimes([on(a) && DEFAULT_SLOT_TIMES.morning, on(b) && DEFAULT_SLOT_TIMES.afternoon, on(c) && DEFAULT_SLOT_TIMES.evening, on(d) && DEFAULT_SLOT_TIMES.night].filter(Boolean) as string[]);
    }
    return normalizeTimes([on(a) && DEFAULT_SLOT_TIMES.morning, on(b) && DEFAULT_SLOT_TIMES.afternoon, on(c) && DEFAULT_SLOT_TIMES.night].filter(Boolean) as string[]);
  }
  const code: Record<string, string[]> = {
    OD: ["08:00"],
    QD: ["08:00"],
    ONCEDAILY: ["08:00"],
    DAILY: ["08:00"],
    BD: ["08:00", "20:00"],
    BID: ["08:00", "20:00"],
    TWICEDAILY: ["08:00", "20:00"],
    TDS: ["08:00", "14:00", "21:00"],
    TID: ["08:00", "14:00", "21:00"],
    QID: ["08:00", "12:00", "16:00", "21:00"],
    QDS: ["08:00", "12:00", "16:00", "21:00"],
    HS: ["22:00"],
    BEDTIME: ["22:00"],
    OM: ["08:00"],
    ON: ["21:00"],
    Q8H: ["06:00", "14:00", "22:00"],
    Q12H: ["08:00", "20:00"],
    Q6H: ["06:00", "12:00", "18:00", "00:00"],
  };
  return code[p] ? [...code[p]] : null;
}
