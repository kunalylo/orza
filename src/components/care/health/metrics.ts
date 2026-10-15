/**
 * Health metric definitions shared by the browser importers (Apple Health, CSV) and the server
 * sync/import pipeline. Pure module — no server or browser APIs — so both sides agree on keys,
 * units, sane ranges and rounding.
 */
import type { HealthSource } from "@/lib/types";

export const HEALTH_METRICS = [
  "steps",
  "active_kcal",
  "distance_km",
  "sleep_minutes",
  "resting_hr",
  "avg_hr",
  "weight_kg",
  "water_ml",
] as const;

export type HealthMetric = (typeof HEALTH_METRICS)[number];
export type HealthDayValues = Partial<Record<HealthMetric, number>>;
/** One local calendar day of daily totals / averages, as sent to /api/health/sync and /api/health/import. */
export type HealthDayInput = { date: string } & HealthDayValues;

export interface MetricInfo {
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Decimal places kept when storing. */
  digits: number;
}

/** Canonical units and the range a real day can fall in. Values outside the range are dropped, never clamped. */
export const METRIC_INFO: Record<HealthMetric, MetricInfo> = {
  steps: { label: "Steps", unit: "steps", min: 0, max: 100_000, digits: 0 },
  active_kcal: { label: "Active energy", unit: "kcal", min: 0, max: 10_000, digits: 0 },
  distance_km: { label: "Walking + running distance", unit: "km", min: 0, max: 300, digits: 2 },
  sleep_minutes: { label: "Sleep", unit: "min", min: 0, max: 1440, digits: 0 },
  resting_hr: { label: "Resting heart rate", unit: "bpm", min: 25, max: 230, digits: 0 },
  avg_hr: { label: "Average heart rate", unit: "bpm", min: 25, max: 230, digits: 0 },
  weight_kg: { label: "Weight", unit: "kg", min: 20, max: 400, digits: 2 },
  water_ml: { label: "Water", unit: "ml", min: 0, max: 10_000, digits: 0 },
};

/* ───────────────────────────── unit conversions ───────────────────────────── */

export const KJ_PER_KCAL = 4.184;
export const KM_PER_MILE = 1.609344;
export const KG_PER_LB = 0.45359237;
export const KG_PER_STONE = 6.35029318;
export const ML_PER_US_FL_OZ = 29.5735;
export const ML_PER_IMP_FL_OZ = 28.4131;
export const ML_PER_US_CUP = 236.588;

/** Energy in `unit` → kcal (kJ ÷ 4.184; "Cal"/"kcal" as-is). Unknown units → null. */
export function toKcal(v: number, unit: string | undefined | null): number | null {
  const u = (unit || "kcal").trim().toLowerCase();
  if (u === "kj" || u === "kilojoule" || u === "kilojoules") return v / KJ_PER_KCAL;
  if (u === "kcal" || u === "cal" || u === "calories" || u === "kilocalories" || u === "kilocalorie") return v;
  if (u === "j") return v / 1000 / KJ_PER_KCAL;
  return null;
}

/** Distance in `unit` → km. Unknown units → null. */
export function toKm(v: number, unit: string | undefined | null): number | null {
  const u = (unit || "km").trim().toLowerCase();
  if (u === "km" || u === "kilometers" || u === "kilometres") return v;
  if (u === "mi" || u === "mile" || u === "miles") return v * KM_PER_MILE;
  if (u === "m" || u === "meters" || u === "metres") return v / 1000;
  if (u === "yd" || u === "yards") return v * 0.0009144;
  if (u === "ft" || u === "feet") return v * 0.0003048;
  return null;
}

/** Body mass in `unit` → kg. Unknown units → null. */
export function toKg(v: number, unit: string | undefined | null): number | null {
  const u = (unit || "kg").trim().toLowerCase();
  if (u === "kg" || u === "kilograms") return v;
  if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") return v * KG_PER_LB;
  if (u === "st" || u === "stone") return v * KG_PER_STONE;
  if (u === "g" || u === "grams") return v / 1000;
  return null;
}

/** Volume in `unit` → ml (US fl oz × 29.57). Unknown units → null. */
export function toMl(v: number, unit: string | undefined | null): number | null {
  const u = (unit || "ml").trim().toLowerCase().replace(/\s+/g, "_");
  if (u === "ml" || u === "milliliters" || u === "millilitres") return v;
  if (u === "l" || u === "liters" || u === "litres") return v * 1000;
  if (u === "fl_oz_us" || u === "fl_oz" || u === "floz" || u === "oz" || u === "fl._oz") return v * ML_PER_US_FL_OZ;
  if (u === "fl_oz_imp") return v * ML_PER_IMP_FL_OZ;
  if (u === "cup_us" || u === "cup") return v * ML_PER_US_CUP;
  return null;
}

/** Duration in `unit` → minutes ("hr" is the default for sleep exports). Unknown units → null. */
export function toMinutes(v: number, unit: string | undefined | null): number | null {
  const u = (unit || "hr").trim().toLowerCase();
  if (u === "hr" || u === "h" || u === "hrs" || u === "hour" || u === "hours") return v * 60;
  if (u === "min" || u === "mins" || u === "minute" || u === "minutes") return v;
  if (u === "s" || u === "sec" || u === "secs" || u === "seconds") return v / 60;
  return null;
}

/* ───────────────────────────── value cleaning ───────────────────────────── */

/** Accepts numbers and numeric strings ("8234", "72.4", "8,234"); everything else → null. */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/[\s ]/g, "");
  if (!s) return null;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^-?\d+,\d+$/.test(s)) return Number(s.replace(",", "."));
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return Number(s);
  return null;
}

export function roundTo(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** A metric value in canonical units, rounded, or undefined when missing / out of range. */
export function cleanMetric(metric: HealthMetric, value: unknown): number | undefined {
  const n = toNumber(value);
  if (n == null) return undefined;
  const info = METRIC_INFO[metric];
  const r = roundTo(n, info.digits);
  if (r < info.min || r > info.max) return undefined;
  return r;
}

/* ───────────────────────────── sources ───────────────────────────── */

export const SOURCE_LABELS: Record<HealthSource, string> = {
  apple_health: "Apple Health import",
  health_connect: "Health Connect",
  health_auto_export: "Health Auto Export",
  shortcut: "Apple Shortcuts",
  csv: "CSV import",
  manual: "Manual entry",
  api: "Sync API",
};

export const HEALTH_SOURCES = Object.keys(SOURCE_LABELS) as HealthSource[];

export const isHealthSource = (s: unknown): s is HealthSource => typeof s === "string" && (HEALTH_SOURCES as string[]).includes(s);

/** Import limits shared by the client importers and the API. */
export const MAX_IMPORT_DAYS = 400;
export const APPLE_IMPORT_DAYS = 365;

/** Sources an automation client may name when posting to /api/health/sync (anything else is recorded as "api"). */
export const SYNC_SOURCES = ["health_connect", "health_auto_export", "shortcut", "api"] as const satisfies readonly HealthSource[];
/** Sources the signed-in importers use with /api/health/import (the web importers and the phone app's HealthKit / Health Connect sync). */
export const IMPORT_SOURCES = ["apple_health", "health_connect", "csv"] as const satisfies readonly HealthSource[];

/* ───────────────────────────── API shapes ───────────────────────────── */

/** One calendar day merged across sources (steps/sleep = max, heart rate = average, weight = most recently updated source). */
export type MergedHealthDay = { date: string; sources: HealthSource[] } & HealthDayValues;

export interface HealthSourceSummary {
  source: HealthSource;
  label: string;
  /** Days this source contributed inside the requested range. */
  days: number;
  first_date: string;
  last_date: string;
  last_updated: string;
}

/** GET /api/health/days */
export interface HealthDaysResponse {
  from: string;
  to: string;
  days: MergedHealthDay[];
  sources: HealthSourceSummary[];
  /** Most recent write from any source (ISO), across all time. */
  last_sync: string | null;
  last_sync_source: HealthSource | null;
}

/** GET /api/health/token */
export interface HealthTokenStatus {
  token: { preview: string; created_at: string | null } | null;
}

/** POST /api/health/token — the plaintext token is returned exactly once. */
export interface HealthTokenCreated {
  token: string;
  preview: string;
  created_at: string;
}

/** POST /api/health/import and /api/health/sync */
export interface HealthWriteResponse {
  ok: true;
  days_updated: number;
  skipped: number;
}
