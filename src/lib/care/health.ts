/**
 * Health sync — server side.
 *
 * Browsers can't read Apple HealthKit or Android Health Connect, so daily health data reaches ÖRZA as:
 *  - imports parsed in the browser (Apple Health export.zip, CSV) → POST /api/health/import (session);
 *  - automation apps / Apple Shortcuts / the future ÖRZA mobile app → POST /api/health/sync with a
 *    personal sync token (`Authorization: Bearer orza_hs_…`), either ÖRZA JSON or the
 *    "Health Auto Export" iOS app's REST format.
 *
 * Tokens are stored as a sha256 hash (plus a 4-character preview); the plaintext is shown once.
 * Days are stored per user + date + source in `health_days`; reads merge sources per date.
 * Steps (max) and weight (only when the day has none) are mirrored into `tracking` so Today,
 * Goals and Reports pick them up.
 */
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { col, newId, nowISO } from "@/lib/db";
import { dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { setTracking, trackingInRange } from "@/lib/domain/tracking";
import type { HealthDay, HealthSource, TrackingDay, User } from "@/lib/types";
import {
  DayAggregator,
  isRealDate,
  localDateOf,
  localDater,
  parseHealthTimestamp,
  shiftDate,
} from "@/components/care/health/aggregate";
import {
  cleanMetric,
  HEALTH_METRICS,
  MAX_IMPORT_DAYS,
  SOURCE_LABELS,
  SYNC_SOURCES,
  toKcal,
  toKg,
  toKm,
  toMinutes,
  toMl,
  toNumber,
  type HealthDayInput,
  type HealthDayValues,
  type HealthSourceSummary,
  type MergedHealthDay,
} from "@/components/care/health/metrics";

export { isRealDate, shiftDate };

/* ───────────────────────────── sync tokens ───────────────────────────── */

export const HEALTH_TOKEN_PREFIX = "orza_hs_";
/** "orza_hs_" + 32 random bytes as unpadded base64url (43 chars). */
const HEALTH_TOKEN_RE = /^orza_hs_[A-Za-z0-9_-]{43}$/;

export const hashHealthToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export const isWellFormedHealthToken = (token: unknown): token is string => typeof token === "string" && HEALTH_TOKEN_RE.test(token);

/** Creates (or rotates) the user's sync token. Returns the plaintext — the only time it exists outside the caller's device. */
export async function createHealthToken(userId: string): Promise<{ token: string; preview: string; created_at: string }> {
  const token = HEALTH_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const preview = token.slice(-4);
  const created_at = nowISO();
  await col<User>("users").updateOne(
    { id: userId },
    {
      $set: {
        "integrations.health_token_hash": hashHealthToken(token),
        "integrations.health_token_preview": preview,
        "integrations.health_token_created_at": created_at,
        updated_at: created_at,
      },
    }
  );
  return { token, preview, created_at };
}

export async function revokeHealthToken(userId: string): Promise<void> {
  await col<User>("users").updateOne(
    { id: userId },
    {
      $unset: {
        "integrations.health_token_hash": "",
        "integrations.health_token_preview": "",
        "integrations.health_token_created_at": "",
      },
      $set: { updated_at: nowISO() },
    }
  );
}

/** Public status of the user's token (never the hash). */
export function healthTokenStatus(user: Pick<User, "integrations">): { preview: string; created_at: string | null } | null {
  const i = user.integrations;
  if (!i?.health_token_hash) return null;
  return { preview: i.health_token_preview || "····", created_at: i.health_token_created_at || null };
}

/** The bearer credential from `Authorization: Bearer <token>`, or null. */
export function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(h);
  return m ? m[1] : null;
}

/** The user owning a sync token, or null. The lookup is by hash; the stored hash is then compared in constant time. */
export async function userByHealthToken(token: string): Promise<User | null> {
  if (!isWellFormedHealthToken(token)) return null;
  const hash = hashHealthToken(token);
  const user = await col<User>("users").findOne({ "integrations.health_token_hash": hash });
  const stored = user?.integrations?.health_token_hash;
  if (!user || typeof stored !== "string") return null;
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || a.length === 0 || !timingSafeEqual(a, b)) return null;
  return user;
}

/* ───────────────────────────── rate limiting (in-memory, per instance) ───────────────────────────── */

type Bucket = { count: number; reset: number };
const g = globalThis as typeof globalThis & { __orzaHealthRate?: Map<string, Bucket> };
const buckets = (g.__orzaHealthRate ??= new Map());

function liveBucket(key: string, windowMs: number, now: number): Bucket {
  let b = buckets.get(key);
  if (!b || b.reset <= now) {
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  return b;
}

/** Counts one hit against `key`; `ok` is false once `limit` hits have been used in the current window. */
export function rateLimitHit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = liveBucket(key, windowMs, now);
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfterSec: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
}

/** Whether `key` has already used up `limit` hits (does not count a hit). */
export function rateLimitExceeded(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = liveBucket(key, windowMs, now);
  return { exceeded: b.count >= limit, retryAfterSec: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
}

/* ───────────────────────────── payload normalisation ───────────────────────────── */

export interface NormalisedDays {
  days: HealthDayInput[];
  /** Entries dropped: bad or future dates, no usable metric, or beyond the per-request day limit. */
  skipped: number;
}

/**
 * Validates and cleans posted days: real dates (a timestamp with an offset is converted to the user's
 * local day), not in the future (one day of slack for devices in another timezone), known metrics
 * only, sane ranges (out-of-range values are dropped, never clamped). Repeated dates merge, the later
 * entry winning per metric. Keeps the most recent `maxDays` days, oldest first.
 */
export function normaliseDays(input: readonly unknown[], opts: { tz: string; today?: string; maxDays?: number }): NormalisedDays {
  const today = opts.today ?? dateInTz(opts.tz);
  const latest = shiftDate(today, 1);
  const maxDays = opts.maxDays ?? MAX_IMPORT_DAYS;
  const dater = localDater(opts.tz);
  const byDate = new Map<string, HealthDayValues>();
  let skipped = 0;
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      skipped++;
      continue;
    }
    const r = raw as Record<string, unknown>;
    const ts = parseHealthTimestamp(r.date);
    const date = ts ? localDateOf(ts, dater) : null;
    if (!date || date > latest || date < "2000-01-01") {
      skipped++;
      continue;
    }
    const values: HealthDayValues = {};
    let any = false;
    for (const m of HEALTH_METRICS) {
      const v = cleanMetric(m, r[m]);
      if (v !== undefined) {
        values[m] = v;
        any = true;
      }
    }
    if (!any) {
      skipped++;
      continue;
    }
    byDate.set(date, { ...byDate.get(date), ...values });
  }
  const dates = [...byDate.keys()].sort();
  const kept = dates.slice(-maxDays);
  skipped += dates.length - kept.length;
  return { days: kept.map((date) => ({ date, ...byDate.get(date) })), skipped };
}

/* ───────────────────────────── Health Auto Export (iOS app) REST format ───────────────────────────── */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Sleep stage names that count as asleep in unaggregated samples ("In Bed" and "Awake" don't). */
const ASLEEP_STAGE_RE = /^(asleep|core|deep|rem|unspecified|asleep ?\(?unspecified\)?|asleep ?(core|deep|rem))$/i;

function haeSleepHours(e: Obj): number | null {
  const total = toNumber(e.totalSleep);
  if (total != null && total > 0) return total;
  const asleep = toNumber(e.asleep);
  if (asleep != null && asleep > 0) return asleep;
  const stages = ["core", "deep", "rem"].reduce((s, k) => s + Math.max(0, toNumber(e[k]) ?? 0), 0);
  if (stages > 0) return stages;
  // Unaggregated sample: {startDate, endDate, qty, value: "Core" | "Deep" | "REM" | "Awake" | "In Bed" …}
  const stage = typeof e.value === "string" ? e.value.trim() : "";
  const qty = toNumber(e.qty);
  if (stage && qty != null && qty > 0 && ASLEEP_STAGE_RE.test(stage)) return qty;
  return null;
}

/**
 * Parses the "Health Auto Export" REST payload `{data:{metrics:[{name, units, data:[{date, qty | Avg | …, source}]}]}}`
 * into daily values in the user's timezone. Additive metrics are summed per source and the largest
 * source wins (raw iPhone + Watch samples aren't double counted); heart rate is averaged; weight keeps
 * the day's latest reading; sleep counts asleep time only and is attributed to the wake-up date.
 */
export function parseHealthAutoExport(body: unknown, tz: string): HealthDayInput[] {
  const metrics = isObj(body) && isObj(body.data) ? body.data.metrics : undefined;
  if (!Array.isArray(metrics)) return [];
  const agg = new DayAggregator();
  const dater = localDater(tz);
  const dayOf = (v: unknown) => {
    const ts = parseHealthTimestamp(v);
    return ts ? localDateOf(ts, dater) : null;
  };

  for (const metric of metrics) {
    if (!isObj(metric) || !Array.isArray(metric.data)) continue;
    const name = String(metric.name ?? "").trim().toLowerCase();
    const units = typeof metric.units === "string" ? metric.units : undefined;
    let order = 0;
    for (const e of metric.data) {
      if (!isObj(e)) continue;
      order++;
      const source = typeof e.source === "string" && e.source.trim() ? e.source.trim() : "default";
      switch (name) {
        case "step_count":
        case "active_energy":
        case "walking_running_distance":
        case "dietary_water": {
          const date = dayOf(e.date);
          const qty = toNumber(e.qty);
          if (!date || qty == null) break;
          if (name === "step_count") agg.addSum("steps", date, source, qty);
          else if (name === "active_energy") agg.addSum("active_kcal", date, source, toKcal(qty, units));
          else if (name === "walking_running_distance") agg.addSum("distance_km", date, source, toKm(qty, units));
          else agg.addSum("water_ml", date, source, toMl(qty, units));
          break;
        }
        case "resting_heart_rate": {
          const date = dayOf(e.date);
          if (date) agg.addAverage("resting_hr", date, toNumber(e.qty ?? e.Avg ?? e.avg));
          break;
        }
        case "heart_rate": {
          const date = dayOf(e.date);
          if (date) agg.addAverage("avg_hr", date, toNumber(e.Avg ?? e.avg ?? e.qty));
          break;
        }
        case "weight_body_mass": {
          const ts = parseHealthTimestamp(e.date);
          const qty = toNumber(e.qty);
          if (!ts || qty == null) break;
          agg.setWeight(localDateOf(ts, dater), ts.epoch ?? order, toKg(qty, units));
          break;
        }
        case "sleep_analysis": {
          const hours = haeSleepHours(e);
          const date = dayOf(e.sleepEnd ?? e.endDate ?? e.inBedEnd ?? e.date);
          if (date && hours != null) agg.addSleepMinutes(date, source, toMinutes(hours, units ?? "hr"));
          break;
        }
        default:
          break;
      }
    }
  }
  return agg.toDays();
}

export type SyncFormat = "orza" | "health_auto_export";

export interface ParsedSync extends NormalisedDays {
  format: SyncFormat;
  source: HealthSource;
}

/** Recognises ÖRZA JSON `{source?, days:[…]}` or a Health Auto Export payload; null when it's neither. */
export function parseSyncPayload(body: unknown, tz: string, today?: string): ParsedSync | null {
  if (!isObj(body)) return null;
  if (isObj(body.data) && Array.isArray(body.data.metrics)) {
    return { format: "health_auto_export", source: "health_auto_export", ...normaliseDays(parseHealthAutoExport(body, tz), { tz, today }) };
  }
  if (Array.isArray(body.days)) {
    const source = (SYNC_SOURCES as readonly string[]).includes(String(body.source)) ? (body.source as HealthSource) : "api";
    return { format: "orza", source, ...normaliseDays(body.days, { tz, today }) };
  }
  return null;
}

/* ───────────────────────────── storage ───────────────────────────── */

async function inBatches<T>(items: readonly T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

/** Two concurrent upserts of a new key can race on the unique index; the retry then matches the winner's document. */
async function retryOnDuplicate<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    if ((e as { code?: number })?.code === 11000) return fn();
    throw e;
  }
}

/**
 * Upserts one document per (user, date, source), `$set`-ting only the metrics provided (a later sync
 * that only carries steps leaves that day's sleep alone). Mirrors steps and weight into tracking.
 */
export async function upsertHealthDays(user: Pick<User, "id">, source: HealthSource, days: readonly HealthDayInput[]): Promise<{ days_updated: number }> {
  const coll = col<HealthDay>("health_days");
  const now = nowISO();
  let updated = 0;
  await inBatches(days, 16, async (day) => {
    const set: Record<string, unknown> = {};
    for (const m of HEALTH_METRICS) if (day[m] !== undefined) set[m] = day[m];
    if (!Object.keys(set).length || !isRealDate(day.date)) return;
    set.updated_at = now;
    await retryOnDuplicate(() =>
      coll.updateOne({ user_id: user.id, date: day.date, source }, { $set: set, $setOnInsert: { id: newId() } }, { upsert: true })
    );
    updated++;
  });
  await mirrorIntoTracking(user.id, days);
  return { days_updated: updated };
}

/**
 * Tracking keeps one row per day for the manual counters. Synced steps only ever raise the day's
 * count (steps = max(existing, synced)); a synced weight fills a day that has no weigh-in yet but
 * never overwrites one the user entered.
 */
async function mirrorIntoTracking(userId: string, days: readonly HealthDayInput[]) {
  const relevant = days.filter((d) => isRealDate(d.date) && (d.steps !== undefined || d.weight_kg !== undefined));
  if (!relevant.length) return;
  const dates = relevant.map((d) => d.date).sort();
  const existing = new Map((await trackingInRange(userId, dates[0], dates[dates.length - 1])).map((t) => [t.date, t]));
  const tracking = col<TrackingDay>("tracking");
  await inBatches(relevant, 16, async (d) => {
    const steps = d.steps !== undefined ? Math.round(d.steps) : undefined;
    const weight = d.weight_kg !== undefined ? Math.round(d.weight_kg * 10) / 10 : undefined;
    const t = existing.get(d.date);
    const now = nowISO();
    if (!t) {
      const fields: { steps?: number; weight_kg?: number } = {};
      if (steps !== undefined) fields.steps = steps;
      if (weight !== undefined) fields.weight_kg = weight;
      await setTracking(userId, d.date, fields);
      return;
    }
    // Conditional updates keep both rules atomic against a concurrent manual entry.
    if (steps !== undefined && steps > (t.steps || 0)) {
      await tracking.updateOne({ user_id: userId, date: d.date, steps: { $lt: steps } }, { $set: { steps, updated_at: now } });
    }
    if (weight !== undefined && t.weight_kg == null) {
      await tracking.updateOne({ user_id: userId, date: d.date, weight_kg: { $exists: false } }, { $set: { weight_kg: weight, updated_at: now } });
    }
  });
}

export async function healthDocsInRange(userId: string, from: string, to: string): Promise<HealthDay[]> {
  return col<HealthDay>("health_days").find({ user_id: userId, date: { $gte: from, $lte: to } }, { sort: { date: 1 } });
}

export async function lastHealthWrite(userId: string): Promise<{ at: string; source: HealthSource } | null> {
  const [doc] = await col<HealthDay>("health_days").find({ user_id: userId }, { sort: { updated_at: -1 }, limit: 1 });
  return doc ? { at: doc.updated_at, source: doc.source } : null;
}

const MAX_METRICS = ["steps", "active_kcal", "distance_km", "sleep_minutes", "water_ml"] as const;
const AVG_METRICS = ["resting_hr", "avg_hr"] as const;

/**
 * Merges per-source documents into one row per date: additive metrics and sleep take the largest
 * source (sources overlap — the same walk is often in Apple Health and a CSV), heart rate averages
 * the sources, weight comes from the most recently updated source.
 */
export function mergeHealthDays(docs: readonly HealthDay[]): MergedHealthDay[] {
  const byDate = new Map<string, HealthDay[]>();
  for (const d of docs) {
    const list = byDate.get(d.date);
    if (list) list.push(d);
    else byDate.set(d.date, [d]);
  }
  const out: MergedHealthDay[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const list = byDate.get(date)!;
    const day: MergedHealthDay = { date, sources: [...new Set(list.map((d) => d.source))] };
    for (const m of MAX_METRICS) {
      const vals = list.map((d) => d[m]).filter((v): v is number => typeof v === "number");
      if (vals.length) day[m] = Math.max(...vals);
    }
    for (const m of AVG_METRICS) {
      const vals = list.map((d) => d[m]).filter((v): v is number => typeof v === "number");
      if (vals.length) day[m] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    const weighed = list.filter((d) => typeof d.weight_kg === "number").sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (weighed.length) day.weight_kg = weighed[0].weight_kg;
    out.push(day);
  }
  return out;
}

/** Per-source summary of the documents in a range, most recently updated first. */
export function summariseSources(docs: readonly HealthDay[]): HealthSourceSummary[] {
  const map = new Map<HealthSource, HealthSourceSummary>();
  for (const d of docs) {
    const s = map.get(d.source);
    if (!s) {
      map.set(d.source, { source: d.source, label: SOURCE_LABELS[d.source] ?? d.source, days: 1, first_date: d.date, last_date: d.date, last_updated: d.updated_at });
      continue;
    }
    s.days++;
    if (d.date < s.first_date) s.first_date = d.date;
    if (d.date > s.last_date) s.last_date = d.date;
    if (d.updated_at > s.last_updated) s.last_updated = d.updated_at;
  }
  return [...map.values()].sort((a, b) => b.last_updated.localeCompare(a.last_updated));
}

export const userTz = (user: Pick<User, "profile">) => user.profile?.timezone || DEFAULT_TZ;
