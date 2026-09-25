/**
 * Pure helpers shared by the reminders UI, the alarm watcher and the server (dispatcher, API routes).
 * No server-only imports here — this file is bundled into the browser too.
 */
import type { DoseTiming, ReminderChannels, ReminderKind, Schedule } from "@/lib/types";

/* ───────────────────────────── Reminder kinds ───────────────────────────── */

export const REMINDER_KINDS: ReminderKind[] = ["meal", "water", "weight", "custom"];

export const KIND_LABEL: Record<ReminderKind, string> = {
  meal: "Meal",
  water: "Water",
  weight: "Weigh-in",
  custom: "Custom",
};

export const KIND_DEFAULT_TITLE: Record<ReminderKind, string> = {
  meal: "Log your meal",
  water: "Drink a glass of water",
  weight: "Weigh-in",
  custom: "Reminder",
};

/** Default notification text when a reminder has no message of its own. */
export const KIND_DEFAULT_BODY: Record<ReminderKind, string> = {
  meal: "Snap it, say it or type it — logging takes a few seconds.",
  water: "A glass now keeps your energy steady.",
  weight: "Step on the scale and log today's weight.",
  custom: "A gentle nudge from ÖRZA.",
};

/** Emoji prefix used in push / WhatsApp titles (never in app chrome). */
export const KIND_EMOJI: Record<ReminderKind, string> = {
  meal: "🍽️",
  water: "💧",
  weight: "⚖️",
  custom: "🔔",
};

/** Where tapping a reminder takes the user. */
export const REMINDER_URL: Record<ReminderKind, string> = {
  meal: "/dashboard/meals",
  water: "/dashboard",
  weight: "/dashboard/goals",
  custom: "/dashboard/reminders",
};

export const DEFAULT_CHANNELS: ReminderChannels = { push: true, whatsapp: false, calendar: false };

export const MAX_REMINDERS = 50;
export const MAX_TIMES_PER_REMINDER = 24;

/* ───────────────────────────── Medicines ───────────────────────────── */

export const TIMING_TEXT: Record<DoseTiming, string> = {
  before_food: "before food",
  after_food: "after food",
  with_food: "with food",
  empty_stomach: "on an empty stomach",
  bedtime: "at bedtime",
  any: "",
};

/** "1 tablet · after food · for Mom" */
export function doseLine(d: { dose?: string; timing?: DoseTiming; for_person?: string }) {
  return [d.dose?.trim(), d.timing ? TIMING_TEXT[d.timing] : "", d.for_person?.trim() ? `for ${d.for_person.trim()}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function medicineLabel(m: { name: string; strength?: string }) {
  return [m.name.trim(), m.strength?.trim()].filter(Boolean).join(" ");
}

/* ───────────────────────────── Presets ───────────────────────────── */

export interface ReminderPreset {
  key: string;
  label: string;
  hint: string;
  kind: ReminderKind;
  title: string;
  body?: string;
  times: string[];
  days: number[];
}

/** "HH:MM" every `stepMinutes` from start to end inclusive (same day). */
export function timesEvery(start: string, end: string, stepMinutes: number): string[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const s = toMin(start);
  const e = toMin(end);
  const step = Math.max(15, Math.round(stepMinutes));
  const out: string[] = [];
  for (let m = s; m <= e && out.length < MAX_TIMES_PER_REMINDER; m += step) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { key: "breakfast", label: "Log breakfast", hint: "Daily · 09:00", kind: "meal", title: "Log breakfast", times: ["09:00"], days: [] },
  { key: "lunch", label: "Log lunch", hint: "Daily · 13:30", kind: "meal", title: "Log lunch", times: ["13:30"], days: [] },
  { key: "dinner", label: "Log dinner", hint: "Daily · 20:30", kind: "meal", title: "Log dinner", times: ["20:30"], days: [] },
  {
    key: "water",
    label: "Water every 2 h",
    hint: "09:00 – 21:00",
    kind: "water",
    title: "Drink a glass of water",
    times: timesEvery("09:00", "21:00", 120),
    days: [],
  },
  { key: "weigh-in", label: "Weekly weigh-in", hint: "Mondays · 07:30", kind: "weight", title: "Weekly weigh-in", times: ["07:30"], days: [1] },
];

/* ───────────────────────────── Schedule text ───────────────────────────── */

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

export function describeDays(days: number[] | undefined): string {
  const set = [...new Set(days || [])].filter((d) => d >= 0 && d <= 6).sort();
  if (!set.length || set.length === 7) return "Every day";
  if (set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.join() === "0,6") return "Weekends";
  if (set.length === 1) return `${WEEKDAYS_SHORT[set[0]]}days`;
  // Start the week on Monday for display.
  return [...set].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS_SHORT[d]).join(", ");
}

export function describeTimes(times: string[]): string {
  const t = [...new Set(times)].sort();
  if (t.length <= 3) return t.join(", ");
  return `${t.length}× a day · ${t[0]} – ${t[t.length - 1]}`;
}

export function describeSchedule(s: Pick<Schedule, "times" | "days" | "every_n_days">): string {
  const every = s.every_n_days && s.every_n_days > 1 ? `Every ${s.every_n_days} days` : describeDays(s.days);
  return `${every} · ${describeTimes(s.times)}`;
}

/* ───────────────────────────── Quiet hours ───────────────────────────── */

export const isHHMM = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Is local wall-clock `time` ("HH:MM") inside quiet hours? Handles windows that cross midnight (22:00 → 07:00). */
export function inQuietWindow(quiet: { start: string; end: string } | null | undefined, time: string): boolean {
  if (!quiet || !isHHMM(quiet.start) || !isHHMM(quiet.end) || quiet.start === quiet.end) return false;
  return quiet.start < quiet.end ? time >= quiet.start && time < quiet.end : time >= quiet.start || time < quiet.end;
}

/* ───────────────────────────── Phone numbers ───────────────────────────── */

export const E164_RE = /^\+[1-9]\d{7,14}$/;

export const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+91", label: "+91 India" },
  { code: "+971", label: "+971 UAE" },
  { code: "+966", label: "+966 Saudi Arabia" },
  { code: "+974", label: "+974 Qatar" },
  { code: "+965", label: "+965 Kuwait" },
  { code: "+968", label: "+968 Oman" },
  { code: "+973", label: "+973 Bahrain" },
  { code: "+977", label: "+977 Nepal" },
  { code: "+880", label: "+880 Bangladesh" },
  { code: "+94", label: "+94 Sri Lanka" },
  { code: "+65", label: "+65 Singapore" },
  { code: "+60", label: "+60 Malaysia" },
  { code: "+44", label: "+44 UK" },
  { code: "+1", label: "+1 USA / Canada" },
  { code: "+61", label: "+61 Australia" },
  { code: "+64", label: "+64 New Zealand" },
];

/**
 * Turn what someone typed into E.164. A number starting with "+" (or "00") keeps its own country code;
 * otherwise `countryCode` (default +91) is added and a leading trunk "0" is dropped.
 */
export function toE164(raw: string, countryCode = "+91"): { ok: true; e164: string } | { ok: false; error: string } {
  const input = (raw || "").trim();
  if (!input) return { ok: false, error: "Enter your WhatsApp number." };
  if (/[^\d\s()+\-.]/.test(input)) return { ok: false, error: "Use digits only, like 98765 43210." };
  let digits = input.replace(/[\s()\-.]/g, "");
  let e164: string;
  if (digits.startsWith("+")) e164 = "+" + digits.slice(1).replace(/\+/g, "");
  else if (digits.startsWith("00")) e164 = "+" + digits.slice(2);
  else {
    digits = digits.replace(/^0+/, "");
    const cc = countryCode.replace(/[^\d]/g, "");
    // Someone typed the country code without "+" (e.g. 919876543210).
    if (cc === "91" && digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    e164 = `+${cc}${digits}`;
  }
  if (!E164_RE.test(e164)) return { ok: false, error: "That doesn't look like a complete phone number." };
  if (e164.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(e164)) {
    return { ok: false, error: "Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9." };
  }
  return { ok: true, e164 };
}

/** Split an E.164 number back into a known country code + national number for editing. */
export function splitE164(e164: string | null | undefined): { code: string; national: string } {
  if (!e164) return { code: "+91", national: "" };
  const match = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length).find((c) => e164.startsWith(c.code));
  if (!match) return { code: "+91", national: e164 };
  return { code: match.code, national: e164.slice(match.code.length) };
}

/** "+91 98765 43210" style display. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const { code, national } = splitE164(e164);
  if (national.startsWith("+")) return national;
  if (code === "+91" && national.length === 10) return `${code} ${national.slice(0, 5)} ${national.slice(5)}`;
  return `${code} ${national}`;
}

/* ───────────────────────────── Alarms ───────────────────────────── */

/** One entry of GET /api/alarms/due. */
export interface DueAlarm {
  kind: "medication" | "reminder";
  /** Dose log id (`${medication_id}:${scheduled_for}`) or `${reminder_id}:${scheduled_for}`. */
  id: string;
  /** Changes when a snoozed dose re-fires, so a dismissed alarm can come back after its snooze. */
  key: string;
  title: string;
  body: string;
  photo_urls: string[];
  scheduled_for: string;
  local_time: string;
  url: string;
  medication_id?: string;
  name?: string;
  strength?: string;
  dose?: string;
  timing_text?: string;
  instructions?: string;
  for_person?: string;
  snoozed?: boolean;
  reminder_id?: string;
  reminder_kind?: ReminderKind;
}

export function alarmUrl(medicationId: string, scheduledFor: string) {
  return `/dashboard/alarm?med=${encodeURIComponent(medicationId)}&at=${encodeURIComponent(scheduledFor)}`;
}

/** GET /api/alarms/due */
export interface DueAlarmsResponse {
  alarms: DueAlarm[];
  /** True while the user's quiet hours are on — the in-app alarm stays silent (no chime / vibration). */
  quiet: boolean;
  server_time: string;
}

/* ───────────────────────────── API shapes ───────────────────────────── */

/** GET /api/integrations (also returned by the PUT routes under /api/integrations). */
export interface IntegrationsView {
  push: { configured: boolean; subscriptions: number; public_key: string | null };
  whatsapp: { configured: boolean; mode: "template" | "session"; phone: string | null; opt_in: boolean };
  calendar: { feed_url: string | null; external_url_set: boolean };
  health: { token_preview: string | null; last_sync: string | null };
  quiet_hours: { start: string; end: string } | null;
  /** Settings → "Gentle reminders". When off, meal / water / weigh-in reminders pause (medicine alarms don't). */
  reminders_enabled: boolean;
  timezone: string;
}

/** A reminder as the API returns it: the stored document plus its next firing time. */
export interface ReminderView {
  id: string;
  kind: ReminderKind;
  title: string;
  body?: string;
  schedule: Schedule;
  channels: ReminderChannels;
  active: boolean;
  created_at: string;
  updated_at: string;
  /** ISO instant of the next occurrence (null when inactive or the schedule has ended). */
  next_at: string | null;
}

/** Friendly "Today 13:30" / "Tomorrow 09:00" / "Mon 07:30" / "12 Oct 07:30" in the given timezone. */
export function describeNext(iso: string | null, tz: string, now: Date = new Date()): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  const target = day(at);
  if (target === day(now)) return `Today ${time}`;
  if (target === day(new Date(now.getTime() + 86400000))) return `Tomorrow ${time}`;
  if (at.getTime() - now.getTime() < 6 * 86400000) {
    return `${new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(at)} ${time}`;
  }
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(at)} ${time}`;
}
