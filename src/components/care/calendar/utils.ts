/**
 * Pure date / grouping / insight helpers for the calendar page. No React, no server imports.
 * All "dates" are local calendar days ("YYYY-MM-DD") in the user's timezone.
 */
import { addDays, daysBetween, utcToZoned, zonedToUtc } from "@/lib/dates";
import type { CalendarEvent, CalendarEventKind } from "./types";

export const WEEKDAYS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const KIND_ORDER: CalendarEventKind[] = ["medication", "reminder", "meal", "external"];

/** Busy time (timed, "busy" events from the user's own calendar) at which a day counts as packed. */
export const BUSY_DAY_MINUTES = 240;

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday on or before `date`. */
export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function weekDates(date: string): string[] {
  const start = mondayOf(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + delta, 1));
  return t.toISOString().slice(0, 7);
}

function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dates shown in a Monday-first month grid: whole weeks covering the month (4–6 rows). */
export function monthGridDates(month: string): string[] {
  const first = `${month}-01`;
  const start = mondayOf(first);
  const lead = daysBetween(start, first);
  const weeks = Math.ceil((lead + daysInMonth(month)) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** Local dates an event occupies (multi-day timed and all-day events span several). */
export function eventDates(e: CalendarEvent, tz: string): string[] {
  if (e.all_day) {
    const end = e.end && e.end > e.start ? e.end : addDays(e.start, 1);
    const n = Math.min(Math.max(1, daysBetween(e.start, end)), 62);
    return Array.from({ length: n }, (_, i) => addDays(e.start, i));
  }
  const start = new Date(e.start);
  const first = utcToZoned(start, tz).date;
  if (!e.end) return [first];
  const endMs = Date.parse(e.end);
  if (!(endMs > start.getTime())) return [first];
  // Exclusive end: an event ending exactly at midnight doesn't occupy the next day.
  const last = utcToZoned(new Date(endMs - 1), tz).date;
  const n = Math.min(Math.max(1, daysBetween(first, last) + 1), 62);
  return Array.from({ length: n }, (_, i) => addDays(first, i));
}

/** Map of local date → events on that day (all-day first, then by start time). */
export function groupByDate(events: CalendarEvent[], tz: string): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    for (const d of eventDates(e, tz)) {
      const list = map.get(d);
      if (list) list.push(e);
      else map.set(d, [e]);
    }
  }
  for (const list of map.values()) list.sort(compareEvents);
  return map;
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.title.localeCompare(b.title);
}

/* ───────────────────────────── Formatting ───────────────────────────── */

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
function timeFormatter(tz: string): Intl.DateTimeFormat {
  let f = timeFormatters.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      f = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    timeFormatters.set(tz, f);
  }
  return f;
}

/** "8:00 am" */
export function formatTime(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return timeFormatter(tz).format(d).replace(/\s?(AM|PM)$/i, (m) => ` ${m.trim().toLowerCase()}`);
}

/** "10:00 am – 11:30 am" (or just the start when there's no end). */
export function formatTimeRange(e: CalendarEvent, tz: string, onDate?: string): string {
  if (e.all_day) return "All day";
  const start = formatTime(e.start, tz);
  if (!e.end || e.kind !== "external") return start;
  const startsToday = !onDate || utcToZoned(new Date(e.start), tz).date === onDate;
  const endsToday = !onDate || utcToZoned(new Date(Date.parse(e.end) - 1), tz).date === onDate;
  const s = startsToday ? start : "Earlier";
  const en = endsToday ? formatTime(e.end, tz) : "later";
  return `${s} – ${en}`;
}

const utcDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};

/** "Thursday, 24 September" */
export function formatLongDate(date: string): string {
  return utcDate(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** "September 2026" */
export function formatMonth(month: string): string {
  return utcDate(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "21 – 27 Sept 2026" / "28 Sept – 4 Oct 2026" */
export function formatWeekRange(dates: string[]): string {
  const a = utcDate(dates[0]);
  const b = utcDate(dates[dates.length - 1]);
  const sameMonth = dates[0].slice(0, 7) === dates[dates.length - 1].slice(0, 7);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  const left = sameMonth ? a.toLocaleDateString("en-IN", { day: "numeric", timeZone: "UTC" }) : a.toLocaleDateString("en-IN", opts);
  return `${left} – ${b.toLocaleDateString("en-IN", { ...opts, year: "numeric" })}`;
}

/* ───────────────────────────── Busy-day insight ───────────────────────────── */

type Interval = [number, number];

function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

/** Busy blocks from the user's own calendar on `date`, clipped to the local day and merged. */
export function busyBlocks(events: CalendarEvent[], date: string, tz: string): Interval[] {
  const dayStart = zonedToUtc(date, "00:00", tz).getTime();
  const dayEnd = zonedToUtc(addDays(date, 1), "00:00", tz).getTime();
  const list: Interval[] = [];
  for (const e of events) {
    if (e.kind !== "external" || e.all_day || e.busy === false || !e.end) continue;
    const s = Math.max(Date.parse(e.start), dayStart);
    const en = Math.min(Date.parse(e.end), dayEnd);
    if (en > s) list.push([s, en]);
  }
  return mergeIntervals(list);
}

export function busyMinutes(events: CalendarEvent[], date: string, tz: string): number {
  return Math.round(busyBlocks(events, date, tz).reduce((sum, [s, e]) => sum + (e - s), 0) / 60000);
}

export interface DayInsight {
  id: string;
  tone: "energy" | "cyan";
  title: string;
  body: string;
}

const hoursLabel = (min: number) => {
  const h = Math.round((min / 60) * 2) / 2;
  return `${h % 1 ? h.toFixed(1) : h} ${h === 1 ? "hour" : "hours"}`;
};

/**
 * Gentle, food-first nudges from the user's own calendar for one day:
 * - ≥ 4 h busy → "Busy day — plan a packed lunch"
 * - no free 30 minutes between 12:00 and 14:30 → eat before the first meeting in that window
 * - a medicine dose inside a busy block → keep the medicine with you
 */
export function dayInsights(events: CalendarEvent[], date: string, tz: string, now: Date = new Date()): DayInsight[] {
  const blocks = busyBlocks(events, date, tz);
  if (!blocks.length) return [];
  const out: DayInsight[] = [];
  const minutes = Math.round(blocks.reduce((sum, [s, e]) => sum + (e - s), 0) / 60000);
  const dayEnd = zonedToUtc(addDays(date, 1), "00:00", tz).getTime();
  if (dayEnd <= now.getTime()) return [];

  if (minutes >= BUSY_DAY_MINUTES) {
    out.push({
      id: "busy",
      tone: "energy",
      title: "Busy day — plan a packed lunch",
      body: `About ${hoursLabel(minutes)} of this day is booked. Pack lunch and a snack the night before and keep water within reach, so a long day doesn't turn into skipped meals.`,
    });
  }

  const lunchStart = zonedToUtc(date, "12:00", tz).getTime();
  const lunchEnd = zonedToUtc(date, "14:30", tz).getTime();
  const inLunch = blocks.filter(([s, e]) => e > lunchStart && s < lunchEnd);
  if (inLunch.length) {
    let cursor = lunchStart;
    let longestGap = 0;
    for (const [s, e] of inLunch) {
      longestGap = Math.max(longestGap, s - cursor);
      cursor = Math.max(cursor, e);
    }
    longestGap = Math.max(longestGap, lunchEnd - cursor);
    if (longestGap < 30 * 60000) {
      const firstStart = inLunch[0][0];
      out.push({
        id: "lunch",
        tone: "energy",
        title: "Meetings run through lunch",
        body:
          firstStart <= lunchStart
            ? "There's no 30-minute break between 12 and 2:30. Have a filling breakfast, and keep a snack you can eat between calls."
            : `There's no 30-minute break between 12 and 2:30. Eat something before ${formatTime(new Date(firstStart).toISOString(), tz)}, or keep a snack you can have between calls.`,
      });
    }
  }

  const clash = events.find(
    (e) =>
      e.kind === "medication" &&
      (e.status === "upcoming" || e.status === "due" || e.status === "snoozed") &&
      blocks.some(([s, en]) => {
        const t = Date.parse(e.start);
        return t >= s && t < en;
      })
  );
  if (clash) {
    out.push({
      id: `dose-${clash.id}`,
      tone: "cyan",
      title: `Your ${formatTime(clash.start, tz)} dose falls in a busy stretch`,
      body: `Keep ${clash.title} with you so a meeting doesn't push the dose back.`,
    });
  }
  return out.slice(0, 3);
}
