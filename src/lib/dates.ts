export const DEFAULT_TZ = "Asia/Kolkata";

/** YYYY-MM-DD for `d` in the given IANA timezone. */
export function dateInTz(tz: string = DEFAULT_TZ, d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }
}

/** Add days to a YYYY-MM-DD string (calendar arithmetic, timezone-free). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** Inclusive list of YYYY-MM-DD from `start` for `n` days. */
export function dateRange(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

export const isISODate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Local hour (0-23) in tz — used to guess meal type. */
export function hourInTz(tz: string = DEFAULT_TZ, d: Date = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(d)) % 24;
  } catch {
    return d.getHours();
  }
}

export function weekdayShort(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}
