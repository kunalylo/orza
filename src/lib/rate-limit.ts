/**
 * Shared request throttling for public endpoints (auth, leads): the client IP a caller can't
 * spoof, and small sliding-window counters kept in process memory.
 *
 * The counters live per server instance. On one long-running Node server that is exact; on
 * serverless hosting every warm instance keeps its own window, so the effective limit is looser
 * (limits keyed on the account, not the IP, still bound brute force per instance).
 */
import { json } from "@/lib/http";

/* ───────────────────────── Client IP ───────────────────────── */

/**
 * How many reverse proxies in front of the app append to X-Forwarded-For (nginx
 * `$proxy_add_x_forwarded_for`, a load balancer, …). Defaults to 1: the right-most entry — added by
 * the nearest proxy, or by Next itself from the socket when the header is missing — is the one a
 * client can't choose. Ignored on Vercel, which overwrites the header.
 */
const TRUSTED_PROXY_HOPS = Math.min(5, Math.max(1, Math.floor(Number(process.env.TRUSTED_PROXY_HOPS) || 1)));

/**
 * Client IP for rate limiting, from hops a client can't spoof. Never trust the first
 * X-Forwarded-For entry off-Vercel: appending proxies keep whatever the client sent there.
 * Limits that must hold even when the IP is unreliable are keyed on the account instead.
 */
export function clientIp(req: Request): string {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || null;
  if (process.env.VERCEL) {
    return first(req.headers.get("x-vercel-forwarded-for")) || first(req.headers.get("x-forwarded-for")) || "unknown";
  }
  const chain = (req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length) return chain[Math.max(0, chain.length - TRUSTED_PROXY_HOPS)];
  return req.headers.get("x-real-ip")?.trim() || "local";
}

/* ───────────────────────── Rate limiting ───────────────────────── */

/**
 * Sliding-window counters kept in process memory. Checks and records happen synchronously
 * (`reserve`), so concurrent requests can't all slip past the check while an earlier one is
 * still awaiting the database or bcrypt.
 */
type Bucket = { hits: number[]; windowMs: number };
type Buckets = Map<string, Bucket>;
const g = globalThis as typeof globalThis & { __orzaAuthBuckets?: Buckets };
const buckets: Buckets = (g.__orzaAuthBuckets ||= new Map());
const MAX_KEYS = 50_000;

function live(key: string, now: number): Bucket | null {
  const b = buckets.get(key);
  if (!b) return null;
  b.hits = b.hits.filter((t) => now - t < b.windowMs);
  if (!b.hits.length) {
    buckets.delete(key);
    return null;
  }
  return b;
}

function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const key of [...buckets.keys()]) live(key, now);
  // Still huge (e.g. a flood of random emails): drop the oldest keys (Map keeps insertion order).
  if (buckets.size > MAX_KEYS) {
    let excess = buckets.size - MAX_KEYS;
    for (const key of buckets.keys()) {
      if (excess-- <= 0) break;
      buckets.delete(key);
    }
  }
}

export type Limit = { key: string; limit: number; windowMs: number };

function waitFor(limits: Limit[], now: number): number {
  let wait = 0;
  for (const l of limits) {
    const b = live(l.key, now);
    if (b && b.hits.length >= l.limit) wait = Math.max(wait, Math.max(1, Math.ceil((b.hits[0] + l.windowMs - now) / 1000)));
  }
  return wait;
}

/**
 * Seconds until every limit has room again, without recording an attempt (0 = there is room).
 * Lets a route refuse an already-throttled caller before it reads or parses the request body.
 */
export function peek(limits: Limit[]): number {
  return waitFor(limits, Date.now());
}

/**
 * Check every limit and, only if all have room, record one attempt against each — atomically
 * (no await in between). Returns the seconds until the caller may try again, or 0 when the
 * attempt was allowed and recorded.
 */
export function reserve(limits: Limit[]): number {
  const now = Date.now();
  const wait = waitFor(limits, now);
  if (wait) return wait;
  prune(now);
  for (const l of limits) {
    const b = live(l.key, now);
    if (b) b.hits.push(now);
    else buckets.set(l.key, { hits: [now], windowMs: l.windowMs });
  }
  return 0;
}

/** Give back one recorded attempt (e.g. a successful sign-in shouldn't count toward a failure budget). */
export function release(key: string) {
  const b = buckets.get(key);
  if (!b) return;
  b.hits.pop();
  if (!b.hits.length) buckets.delete(key);
}

export function clearLimit(key: string) {
  buckets.delete(key);
}

/** 429 `{error, code: "rate_limited"}` with a Retry-After header and a friendly "try again in N minutes". */
export function tooManyRequests(retryAfter: number, message: string) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return json(
    { error: `${message} Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export const ONE_MINUTE = 60 * 1000;
export const TEN_MINUTES = 10 * 60 * 1000;
export const ONE_HOUR = 60 * 60 * 1000;
