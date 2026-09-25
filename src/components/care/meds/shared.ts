/**
 * Client-side types and pure helpers for the medicines screens, the alarm and the Today card.
 */
import type { DoseTiming, ExtractedMedicine, Medication, MedForm, Prescription, Schedule } from "@/lib/types";
import type { TagTone } from "@/components/orza/primitives";

/* ───────────────────────────── API shapes ───────────────────────────── */

export type MedicationClient = Medication & {
  photo_urls: string[];
  /** Created from a prescription and still showing only the prescription photo. */
  uses_prescription_photo?: boolean;
};

export type DoseStatusView = "upcoming" | "due" | "taken" | "skipped" | "snoozed" | "missed";

export interface DoseItem {
  medication_id: string;
  name: string;
  strength?: string;
  dose: string;
  timing: DoseTiming;
  form: MedForm;
  instructions?: string;
  photo_urls: string[];
  scheduled_for: string;
  local_date: string;
  local_time: string;
  status: DoseStatusView;
  snooze_until?: string;
  acted_at?: string;
  for_person?: string;
}

export interface TodayResponse {
  date: string;
  now: string;
  doses: DoseItem[];
}

export interface DueResponse {
  now: string;
  doses: DoseItem[];
  next?: DoseItem | null;
}

export interface Tally {
  scheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  upcoming: number;
  total: number;
  rate: number | null;
}

export interface AdherenceResponse {
  days: number;
  from: string;
  to: string;
  overall: Tally;
  daily: (Tally & { date: string })[];
  medicines: (Tally & { medication_id: string; name: string; strength?: string; for_person?: string; photo_url: string | null })[];
}

export type PrescriptionClient = Prescription & { photo_url: string | null; patient_name?: string; applied_at?: string };

export type DoseAction = "take" | "skip" | "snooze";

/* ───────────────────────────── Labels ───────────────────────────── */

export const FORM_OPTIONS: { value: MedForm; label: string }[] = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup / liquid" },
  { value: "drops", label: "Drops" },
  { value: "injection", label: "Injection" },
  { value: "inhaler", label: "Inhaler / spray" },
  { value: "cream", label: "Cream / ointment" },
  { value: "powder", label: "Powder / sachet" },
  { value: "other", label: "Other" },
];

export const FORM_LABEL = Object.fromEntries(FORM_OPTIONS.map((o) => [o.value, o.label])) as Record<MedForm, string>;

/** Suggested dose when the user picks a form (only used while the dose field is untouched). */
export const DEFAULT_DOSE: Record<MedForm, string> = {
  tablet: "1 tablet",
  capsule: "1 capsule",
  syrup: "5 ml",
  drops: "1 drop",
  injection: "1 injection",
  inhaler: "1 puff",
  cream: "Apply a thin layer",
  powder: "1 sachet",
  other: "1 dose",
};

export const TIMING_OPTIONS: { value: DoseTiming; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "before_food", label: "Before food" },
  { value: "after_food", label: "After food" },
  { value: "with_food", label: "With food" },
  { value: "empty_stomach", label: "Empty stomach" },
  { value: "bedtime", label: "At bedtime" },
];

export const TIMING_LABEL = Object.fromEntries(TIMING_OPTIONS.map((o) => [o.value, o.label])) as Record<DoseTiming, string>;

/** Sentence used on the alarm: "Take it after food." */
export const TIMING_INSTRUCTION: Record<DoseTiming, string> = {
  any: "",
  before_food: "Take it before food",
  after_food: "Take it after food",
  with_food: "Take it with food",
  empty_stomach: "Take it on an empty stomach",
  bedtime: "Take it at bedtime",
};

export const STATUS_META: Record<DoseStatusView, { label: string; tone: TagTone }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  due: { label: "Due now", tone: "energy" },
  snoozed: { label: "Snoozed", tone: "info" },
  taken: { label: "Taken", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  missed: { label: "Missed", tone: "danger" },
};

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday-first order for weekday pickers. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* ───────────────────────────── Formatting ───────────────────────────── */

/** "20:30" → "8:30 pm" */
export function formatTime12(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return hhmm;
  const h = Number(m[1]);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-30" → "30 Sep" (adds the year when it differs from `refYear`). */
export function formatDateShort(date: string, refYear?: number): string {
  const [y, m, d] = (date || "").split("-").map(Number);
  if (!y || !m || !d) return date;
  const base = `${d} ${MONTHS[m - 1]}`;
  return refYear && refYear !== y ? `${base} ${y}` : base;
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Calendar arithmetic on YYYY-MM-DD strings (timezone-free). */
export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetweenISO(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Today's YYYY-MM-DD in the user's timezone. */
export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Current wall-clock time in the user's timezone, e.g. "8:04 pm". */
export function clockIn(tz: string, d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(d).toLowerCase();
  } catch {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
}

/** "Every day", "Alternate days", "Mon, Wed, Fri", "Every 3 days". */
export function repeatSummary(s: Pick<Schedule, "days" | "every_n_days">): string {
  const n = s.every_n_days && s.every_n_days > 1 ? s.every_n_days : 1;
  const days = s.days?.length && s.days.length < 7 ? s.days : [];
  const dayText = days.length
    ? [...days].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b)).map((d) => WEEKDAYS[d]).join(", ")
    : "";
  if (n === 2) return dayText ? `Alternate days · ${dayText}` : "Alternate days";
  if (n === 7 && !dayText) return "Once a week";
  if (n > 1) return dayText ? `Every ${n} days · ${dayText}` : `Every ${n} days`;
  if (dayText === "Mon, Tue, Wed, Thu, Fri") return "Weekdays";
  if (dayText === "Sat, Sun") return "Weekends";
  return dayText || "Every day";
}

/** "Every day · 8:00 am, 9:00 pm · until 30 Sep" */
export function scheduleSummary(m: Pick<Medication, "schedule" | "as_needed">, today?: string): string {
  if (m.as_needed) return "Only when needed (SOS) · no alarms";
  const s = m.schedule;
  const year = today ? Number(today.slice(0, 4)) : undefined;
  const parts = [repeatSummary(s), s.times.map(formatTime12).join(", ")];
  if (today && s.start_date > today) parts.push(`from ${formatDateShort(s.start_date, year)}`);
  if (s.end_date) parts.push(today && s.end_date < today ? `ended ${formatDateShort(s.end_date, year)}` : `until ${formatDateShort(s.end_date, year)}`);
  return parts.filter(Boolean).join(" · ");
}

/** Doses per day on average (for stock → days-left). */
export function dosesPerDay(m: Pick<Medication, "schedule" | "as_needed">): number {
  if (m.as_needed) return 0;
  const perActiveDay = m.schedule.times.length;
  const n = m.schedule.every_n_days && m.schedule.every_n_days > 1 ? m.schedule.every_n_days : 1;
  const dayShare = m.schedule.days?.length ? m.schedule.days.length / 7 : 1;
  return (perActiveDay * dayShare) / n;
}

/** Stock threshold at which "Refill soon" shows: the user's own, else ~5 days of doses (min 5). */
export function refillThreshold(m: Pick<Medication, "schedule" | "as_needed" | "stock">): number {
  if (m.stock?.refill_alert_at != null) return m.stock.refill_alert_at;
  return Math.max(5, Math.ceil(dosesPerDay(m) * 5));
}

export function needsRefill(m: Pick<Medication, "schedule" | "as_needed" | "stock" | "active">): boolean {
  return !!m.active && !!m.stock && m.stock.count <= refillThreshold(m);
}

/** "About 6 days left" — null when unknown. */
export function daysLeftText(m: Pick<Medication, "schedule" | "as_needed" | "stock">): string | null {
  if (!m.stock) return null;
  const perDay = dosesPerDay(m);
  if (!perDay) return null;
  const d = Math.floor(m.stock.count / perDay);
  if (d <= 0) return "Runs out today";
  return d === 1 ? "About 1 day left" : `About ${d} days left`;
}

export function medicineTitle(m: { name: string; strength?: string }): string {
  return [m.name, m.strength].filter(Boolean).join(" ");
}

/** Is this dose still actionable (not taken / skipped)? */
export const isOpen = (d: Pick<DoseItem, "status">) => d.status !== "taken" && d.status !== "skipped";

/** Sort key: what needs attention first — due, missed, snoozed, upcoming, then done. */
export function attentionRank(s: DoseStatusView): number {
  return { due: 0, missed: 1, snoozed: 2, upcoming: 3, taken: 4, skipped: 5 }[s];
}

export function alarmHref(d: Pick<DoseItem, "medication_id" | "scheduled_for">): string {
  return `/dashboard/alarm?med=${encodeURIComponent(d.medication_id)}&at=${encodeURIComponent(d.scheduled_for)}`;
}

export type ReviewRow = ExtractedMedicine & { key: string; include: boolean };
