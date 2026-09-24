/**
 * RFC 5545 (iCalendar) writer for ÖRZA's subscribable care calendar.
 *
 * Pure and dependency-free (type-only imports), so it can be unit-tested in isolation:
 * - CRLF line endings, 75-octet line folding that never splits a UTF-8 character or a TEXT escape pair
 * - TEXT escaping of backslash, semicolon, comma and newlines (control characters are dropped)
 * - One VEVENT per medication dose / reminder occurrence, each with a VALARM so phone calendars ring it
 *
 * The data loading (doses, reminders) lives in `src/app/api/calendar/_lib/feed.ts`.
 */
import type { DoseView } from "@/lib/care/meds";
import type { DoseTiming, Reminder, ReminderKind } from "@/lib/types";

export const CRLF = "\r\n";
export const ICS_CALENDAR_NAME = "ÖRZA · Medicines & reminders";
export const ICS_PRODID = "-//ORZA//Care Calendar 1.0//EN";
/** Length of a dose / reminder block in the calendar. */
export const ICS_EVENT_MINUTES = 15;

/* ───────────────────────────── Low-level formatting ───────────────────────────── */

/** Escape a TEXT value (RFC 5545 §3.3.11): `\` `;` `,` and line breaks. Drops other control characters. */
export function escapeText(value: string): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function utf8Length(cp: number): number {
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/**
 * Fold a content line to at most `limit` octets per physical line (RFC 5545 §3.1).
 * Continuation lines start with a single space, which counts toward the limit.
 * Splits only between whole code points and never inside a `\x` escape pair.
 */
export function foldLine(line: string, limit = 75): string {
  const units = line.match(/\\[\s\S]|[\s\S]/gu) || [];
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let max = limit;
  for (const unit of units) {
    let b = 0;
    for (const ch of unit) b += utf8Length(ch.codePointAt(0) as number);
    if (bytes + b > max && cur) {
      out.push(cur);
      cur = "";
      bytes = 0;
      max = limit - 1; // room for the leading space
    }
    cur += unit;
    bytes += b;
  }
  out.push(cur);
  return out.join(`${CRLF} `);
}

/** "20260924T023000Z" */
export function formatUtc(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
}

function formatParamValue(v: string): string {
  const clean = v.replace(/["\r\n]/g, "");
  return /[:;,]/.test(clean) ? `"${clean}"` : clean;
}

/** One folded content line: NAME;PARAM=VALUE:value */
export function contentLine(name: string, value: string, params?: Record<string, string>): string {
  const p = params
    ? Object.entries(params)
        .map(([k, v]) => `;${k}=${formatParamValue(v)}`)
        .join("")
    : "";
  return foldLine(`${name}${p}:${value}`);
}

/* ───────────────────────────── Calendar model ───────────────────────────── */

export interface IcsAlarm {
  description: string;
  /** Duration relative to the event start; default "PT0M" (at the scheduled time). */
  trigger?: string;
}

export interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  url?: string;
  location?: string;
  categories?: string[];
  alarm?: IcsAlarm | null;
  lastModified?: Date;
  /** Shown as free time (doses and reminders shouldn't block availability). */
  transparent?: boolean;
}

export interface IcsCalendar {
  name: string;
  description?: string;
  timezone: string;
  events: IcsEvent[];
  /** DTSTAMP for every event (the time this calendar object was generated). */
  stamp?: Date;
  color?: string;
}

function eventLines(e: IcsEvent, stamp: Date): string[] {
  const lines = [
    "BEGIN:VEVENT",
    contentLine("UID", escapeText(e.uid)),
    contentLine("DTSTAMP", formatUtc(stamp)),
    contentLine("DTSTART", formatUtc(e.start)),
    contentLine("DTEND", formatUtc(e.end)),
    contentLine("SUMMARY", escapeText(e.summary)),
  ];
  if (e.description) lines.push(contentLine("DESCRIPTION", escapeText(e.description)));
  if (e.location) lines.push(contentLine("LOCATION", escapeText(e.location)));
  if (e.url) lines.push(contentLine("URL", e.url));
  if (e.categories?.length) lines.push(contentLine("CATEGORIES", e.categories.map(escapeText).join(",")));
  lines.push(contentLine("STATUS", "CONFIRMED"));
  lines.push(contentLine("TRANSP", e.transparent === false ? "OPAQUE" : "TRANSPARENT"));
  if (e.lastModified && !Number.isNaN(e.lastModified.getTime())) lines.push(contentLine("LAST-MODIFIED", formatUtc(e.lastModified)));
  if (e.alarm) {
    lines.push(
      "BEGIN:VALARM",
      contentLine("ACTION", "DISPLAY"),
      contentLine("DESCRIPTION", escapeText(e.alarm.description)),
      contentLine("TRIGGER", e.alarm.trigger || "PT0M"),
      "END:VALARM"
    );
  }
  lines.push("END:VEVENT");
  return lines;
}

/** Serialize a whole VCALENDAR (CRLF line endings, trailing CRLF). */
export function buildCalendar(cal: IcsCalendar): string {
  const stamp = cal.stamp || new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    contentLine("VERSION", "2.0"),
    contentLine("PRODID", ICS_PRODID),
    contentLine("CALSCALE", "GREGORIAN"),
    contentLine("METHOD", "PUBLISH"),
    contentLine("X-WR-CALNAME", escapeText(cal.name)),
    contentLine("NAME", escapeText(cal.name)),
    ...(cal.description ? [contentLine("X-WR-CALDESC", escapeText(cal.description))] : []),
    contentLine("X-WR-TIMEZONE", cal.timezone),
    contentLine("REFRESH-INTERVAL", "PT1H", { VALUE: "DURATION" }),
    contentLine("X-PUBLISHED-TTL", "PT1H"),
    ...(cal.color ? [contentLine("X-APPLE-CALENDAR-COLOR", cal.color)] : []),
  ];
  const sorted = [...cal.events].sort((a, b) => a.start.getTime() - b.start.getTime() || a.uid.localeCompare(b.uid));
  for (const e of sorted) lines.push(...eventLines(e, stamp));
  lines.push("END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}

/* ───────────────────────────── ÖRZA events ───────────────────────────── */

export const TIMING_TEXT: Record<DoseTiming, string> = {
  before_food: "Before food",
  after_food: "After food",
  with_food: "With food",
  empty_stomach: "On an empty stomach",
  bedtime: "At bedtime",
  any: "Any time of day",
};

const REMINDER_ICON: Record<ReminderKind, string> = { meal: "🍽️", water: "💧", weight: "⚖️", custom: "🔔" };
const REMINDER_PATH: Record<ReminderKind, string> = {
  meal: "/dashboard/meals",
  water: "/dashboard",
  weight: "/dashboard/goals",
  custom: "/dashboard/reminders",
};

const trimSlash = (s: string) => s.replace(/\/+$/, "");

/** Absolute link to the full-screen alarm (large medicine photos + Take / Snooze / Skip). */
export function alarmUrl(baseUrl: string, medicationId: string, scheduledFor: string): string {
  return `${trimSlash(baseUrl)}/dashboard/alarm?med=${encodeURIComponent(medicationId)}&at=${encodeURIComponent(scheduledFor)}`;
}

/** "💊 Metformin 500 mg — 1 tablet" (+ " · for Mom" in caregiver mode). */
export function doseSummary(d: Pick<DoseView, "name" | "strength" | "dose" | "for_person">): string {
  const name = [d.name, d.strength].filter(Boolean).join(" ");
  return `💊 ${name} — ${d.dose}${d.for_person ? ` · for ${d.for_person}` : ""}`;
}

/** VEVENT for one scheduled medication dose. Taken/skipped doses keep their event but lose the alarm. */
export function medicationDoseEvent(dose: DoseView, opts: { baseUrl: string; updatedAt?: string }): IcsEvent {
  const start = new Date(dose.scheduled_for);
  const url = alarmUrl(opts.baseUrl, dose.medication_id, dose.scheduled_for);
  const acted = dose.status === "taken" || dose.status === "skipped";
  const name = [dose.name, dose.strength].filter(Boolean).join(" ");
  const description = [
    `${dose.dose} · ${TIMING_TEXT[dose.timing] || TIMING_TEXT.any}`,
    dose.for_person ? `For: ${dose.for_person}` : "",
    dose.instructions ? `Instructions: ${dose.instructions}` : "",
    dose.status === "taken" ? "Marked as taken in ÖRZA." : dose.status === "skipped" ? "Marked as skipped in ÖRZA." : "",
    `Open the alarm with photos: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    uid: `${dose.medication_id}-${dose.scheduled_for}@orza`,
    start,
    end: new Date(start.getTime() + ICS_EVENT_MINUTES * 60000),
    summary: doseSummary(dose),
    description,
    url,
    categories: ["Medicine", "ÖRZA"],
    alarm: acted
      ? null
      : { description: `Time for ${name} — ${dose.dose} (${(TIMING_TEXT[dose.timing] || TIMING_TEXT.any).toLowerCase()})` },
    lastModified: opts.updatedAt ? new Date(opts.updatedAt) : undefined,
    transparent: true,
  };
}

/** VEVENT for one occurrence of a reminder with `channels.calendar`. */
export function reminderEvent(reminder: Pick<Reminder, "id" | "kind" | "title" | "body" | "updated_at">, occurrenceIso: string, opts: { baseUrl: string }): IcsEvent {
  const start = new Date(occurrenceIso);
  const url = `${trimSlash(opts.baseUrl)}${REMINDER_PATH[reminder.kind] || REMINDER_PATH.custom}`;
  const icon = REMINDER_ICON[reminder.kind] || REMINDER_ICON.custom;
  return {
    uid: `${reminder.id}-${occurrenceIso}@orza`,
    start,
    end: new Date(start.getTime() + ICS_EVENT_MINUTES * 60000),
    summary: `${icon} ${reminder.title}`,
    description: [reminder.body || "", `Open ÖRZA: ${url}`].filter(Boolean).join("\n"),
    url,
    categories: ["Reminder", "ÖRZA"],
    alarm: { description: reminder.body ? `${reminder.title} — ${reminder.body}` : reminder.title },
    lastModified: reminder.updated_at ? new Date(reminder.updated_at) : undefined,
    transparent: true,
  };
}
