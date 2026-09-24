/** Date/label helpers for the Today screen. `date` values are local calendar days ("YYYY-MM-DD"). */
import { addDays, isISODate } from "@/lib/dates";

const asUTC = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Shape + calendar check (rejects e.g. "2026-02-31"). */
export function isRealDay(s: unknown): s is string {
  if (!isISODate(s)) return false;
  try {
    return addDays(s, 0) === s;
  } catch {
    return false;
  }
}

/** "Tuesday, 23 September" */
export const formatLong = (date: string) =>
  asUTC(date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** "Tue, 23 Sep" */
export const formatShort = (date: string) =>
  asUTC(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Tuesday" */
export const weekdayLong = (date: string) => asUTC(date).toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });

/** "Tue" */
export const weekdayShortLabel = (date: string) => asUTC(date).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });

export const dayOfMonth = (date: string) => Number(date.slice(8, 10));

/** "Today" / "Yesterday" / "Sun, 21 Sep" */
export function relativeDay(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return formatShort(date);
}

export function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 23) return "Good evening";
  return "Hello";
}

/** "8:42 am" in the user's timezone. */
export function timeInTz(iso: string, tz?: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || "Asia/Kolkata" });
  } catch {
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  }
}

export const firstName = (name?: string, email?: string) => {
  const n = (name || "").trim().split(/\s+/)[0];
  if (n) return n;
  const local = (email || "").split("@")[0].split(/[._-]/)[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "there";
};

/** Weight display respecting the unit preference (stored in kg). */
export const KG_PER_LB = 0.45359237;
export const kgToDisplay = (kg: number, imperial: boolean) => (imperial ? Math.round((kg / KG_PER_LB) * 10) / 10 : Math.round(kg * 10) / 10);
export const displayToKg = (v: number, imperial: boolean) => (imperial ? Math.round(v * KG_PER_LB * 10) / 10 : Math.round(v * 10) / 10);
