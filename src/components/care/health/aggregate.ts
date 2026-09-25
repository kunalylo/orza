/**
 * Timestamp handling and per-day aggregation shared by the Apple Health export scanner and the
 * CSV importer (browser) and the Health Auto Export parser (server). Pure module — no server or
 * browser APIs beyond Intl — so every path turns raw samples into daily values the same way.
 */
import { cleanMetric, HEALTH_METRICS, type HealthDayInput, type HealthMetric } from "./metrics";

/* ───────────────────────────── dates & timestamps ───────────────────────────── */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day in YYYY-MM-DD form (rejects 2026-02-30). */
export function isRealDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Calendar arithmetic on YYYY-MM-DD (timezone-free). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface HealthTimestamp {
  /** The calendar date as written by the device (its own wall clock). */
  wallDate: string;
  /** UTC epoch ms when the value carries an offset (or Z); null for date-only or offset-less values. */
  epoch: number | null;
  /** True when the wall-clock time is exactly 00:00:00 — how apps stamp a whole-day total. */
  midnight: boolean;
}

// "2026-09-24", "2026-09-24 07:30:00 +0530", "2026-09-24T07:30:00.000+05:30", "2026-09-24T02:00:00Z"
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

export function parseHealthTimestamp(input: unknown): HealthTimestamp | null {
  if (typeof input !== "string") return null;
  const m = TS_RE.exec(input.trim());
  if (!m) return null;
  const [, y, mo, d, hh, mi, ss, frac, off] = m;
  const wallDate = `${y}-${mo}-${d}`;
  if (!isRealDate(wallDate)) return null;
  if (hh === undefined) return { wallDate, epoch: null, midnight: false };
  const H = Number(hh);
  const M = Number(mi);
  const S = ss ? Number(ss) : 0;
  if (H > 23 || M > 59 || S > 60) return null;
  const ms = frac ? Math.round(Number(`0.${frac}`) * 1000) : 0;
  const midnight = H === 0 && M === 0 && S === 0 && ms === 0;
  if (off === undefined) return { wallDate, epoch: null, midnight };
  let offMin = 0;
  if (off.toUpperCase() !== "Z") {
    const sign = off[0] === "-" ? -1 : 1;
    const digits = off.slice(1).replace(":", "");
    const oh = Number(digits.slice(0, 2));
    const om = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
    if (oh > 18 || om > 59) return null;
    offMin = sign * (oh * 60 + om);
  }
  return { wallDate, epoch: Date.UTC(Number(y), Number(mo) - 1, Number(d), H, M, S, ms) - offMin * 60_000, midnight };
}

const OFFSET_BUCKET_MS = 15 * 60_000; // every real-world offset change lands on a 15-minute boundary

/**
 * Returns a fast `epoch → local YYYY-MM-DD in tz` function. Offsets are cached per 15-minute
 * bucket, so scanning millions of samples costs a handful of Intl calls instead of millions.
 */
export function localDater(tz: string): (epoch: number) => string {
  const opts: Intl.DateTimeFormatOptions = {
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz });
  } catch {
    fmt = new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "Asia/Kolkata" });
  }
  const cache = new Map<number, number>();
  return (epoch: number) => {
    const bucket = Math.floor(epoch / OFFSET_BUCKET_MS);
    let off = cache.get(bucket);
    if (off === undefined) {
      const t = bucket * OFFSET_BUCKET_MS;
      const parts = fmt.formatToParts(new Date(t));
      const get = (k: string) => Number(parts.find((p) => p.type === k)?.value);
      off = Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute")) - t) / 60_000);
      cache.set(bucket, off);
    }
    return new Date(epoch + off * 60_000).toISOString().slice(0, 10);
  };
}

/** Local day of a parsed timestamp: instants are converted into the user's timezone, wall-clock values kept as written. */
export function localDateOf(ts: HealthTimestamp, dater: (epoch: number) => string): string {
  return ts.epoch != null ? dater(ts.epoch) : ts.wallDate;
}

/**
 * Local day for a daily value. A total stamped at exactly midnight ("2026-09-24 00:00:00 +0900", as
 * Health Auto Export and most CSV exports write day buckets) is that calendar day wherever the phone
 * was; any other instant is converted into the user's timezone.
 */
export function dayBucketOf(ts: HealthTimestamp, dater: (epoch: number) => string): string {
  return ts.midnight ? ts.wallDate : localDateOf(ts, dater);
}

/* ───────────────────────────── day aggregation ───────────────────────────── */

/** Metrics that add up over a day. Summed per source, then the largest source wins (iPhone + Watch aren't double counted). */
export type AdditiveMetric = "steps" | "active_kcal" | "distance_km" | "water_ml";
/** Metrics averaged over every sample of the day. */
export type AverageMetric = "resting_hr" | "avg_hr";

interface SleepAcc {
  minutes: number;
  intervals: Array<[number, number]>;
}

interface DayAcc {
  sums: Partial<Record<AdditiveMetric, Map<string, number>>>;
  avgs: Partial<Record<AverageMetric, { sum: number; n: number }>>;
  weight?: { at: number; kg: number };
  sleep?: Map<string, SleepAcc>;
}

function unionMinutes(intervals: Array<[number, number]>): number {
  if (!intervals.length) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [s, e] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [ns, ne] = sorted[i];
    if (ns <= e) e = Math.max(e, ne);
    else {
      total += e - s;
      s = ns;
      e = ne;
    }
  }
  total += e - s;
  return total / 60_000;
}

export class DayAggregator {
  private days = new Map<string, DayAcc>();

  private day(date: string): DayAcc {
    let d = this.days.get(date);
    if (!d) {
      d = { sums: {}, avgs: {} };
      this.days.set(date, d);
    }
    return d;
  }

  get size() {
    return this.days.size;
  }

  addSum(metric: AdditiveMetric, date: string, source: string, value: number | null | undefined) {
    if (value == null || !Number.isFinite(value) || value < 0) return;
    const d = this.day(date);
    const bySource = (d.sums[metric] ??= new Map());
    bySource.set(source, (bySource.get(source) ?? 0) + value);
  }

  addAverage(metric: AverageMetric, date: string, value: number | null | undefined, weight = 1) {
    if (value == null || !Number.isFinite(value) || value <= 0 || !(weight > 0)) return;
    const d = this.day(date);
    const acc = (d.avgs[metric] ??= { sum: 0, n: 0 });
    acc.sum += value * weight;
    acc.n += weight;
  }

  /** Keeps the latest weigh-in of the day (ties: the later call wins). */
  setWeight(date: string, at: number, kg: number | null | undefined) {
    if (kg == null || !Number.isFinite(kg) || kg <= 0) return;
    const d = this.day(date);
    if (!d.weight || at >= d.weight.at) d.weight = { at, kg };
  }

  private sleepAcc(date: string, source: string): SleepAcc {
    const d = this.day(date);
    const bySource = (d.sleep ??= new Map());
    let acc = bySource.get(source);
    if (!acc) {
      acc = { minutes: 0, intervals: [] };
      bySource.set(source, acc);
    }
    return acc;
  }

  /** Pre-summed sleep (e.g. "7.2 h asleep") attributed to the wake-up date. */
  addSleepMinutes(date: string, source: string, minutes: number | null | undefined) {
    if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return;
    this.sleepAcc(date, source).minutes += minutes;
  }

  /** A sleep sample [start, end) in epoch ms; overlapping samples from one source are merged before summing. */
  addSleepInterval(date: string, source: string, start: number, end: number) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 24 * 3_600_000) return;
    this.sleepAcc(date, source).intervals.push([start, end]);
  }

  /** Daily values in canonical units, oldest first; out-of-range values are dropped by `cleanMetric`. */
  toDays(range: { since?: string; until?: string } = {}): HealthDayInput[] {
    const out: HealthDayInput[] = [];
    const dates = [...this.days.keys()].sort();
    for (const date of dates) {
      if (range.since && date < range.since) continue;
      if (range.until && date > range.until) continue;
      const d = this.days.get(date)!;
      const raw: Partial<Record<HealthMetric, number>> = {};
      for (const [metric, bySource] of Object.entries(d.sums) as Array<[AdditiveMetric, Map<string, number>]>) {
        let max = -1;
        for (const v of bySource.values()) max = Math.max(max, v);
        if (max >= 0) raw[metric] = max;
      }
      for (const [metric, acc] of Object.entries(d.avgs) as Array<[AverageMetric, { sum: number; n: number }]>) {
        if (acc.n > 0) raw[metric] = acc.sum / acc.n;
      }
      if (d.weight) raw.weight_kg = d.weight.kg;
      if (d.sleep) {
        let best = 0;
        for (const acc of d.sleep.values()) best = Math.max(best, acc.minutes + unionMinutes(acc.intervals));
        if (best > 0) raw.sleep_minutes = best;
      }
      const day: HealthDayInput = { date };
      let any = false;
      for (const m of HEALTH_METRICS) {
        if (raw[m] === undefined) continue;
        const v = cleanMetric(m, raw[m]);
        if (v !== undefined) {
          day[m] = v;
          any = true;
        }
      }
      if (any) out.push(day);
    }
    return out;
  }
}
