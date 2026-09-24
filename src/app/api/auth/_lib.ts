/**
 * Shared helpers for the auth routes: input schemas, request-origin guard, a small in-memory
 * rate limiter, and friendly validation responses. (Not a route — Next only routes `route.ts`.)
 */
import { z, type ZodTypeAny } from "zod";
import { HttpError, badRequest, json } from "@/lib/http";
import { SITE } from "@/lib/site";

export const emailSchema = z
  .string({ required_error: "Please enter your email" })
  .trim()
  .toLowerCase()
  .min(1, "Please enter your email")
  .max(254, "That email is too long")
  .email("Please enter a valid email address");

export const registerSchema = z.object({
  name: z
    .string({ required_error: "Please enter your name" })
    .trim()
    .min(1, "Please enter your name")
    .max(60, "Please keep your name under 60 characters"),
  email: emailSchema,
  password: z
    .string({ required_error: "Please choose a password" })
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Please enter your password" })
    .min(1, "Please enter your password")
    .max(128, "Incorrect email or password"),
});

/* ───────────────────────── Request origin guard ───────────────────────── */

const hostOf = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
};

const crossSite = () =>
  new HttpError(403, "This request didn't come from ÖRZA. Please refresh the page and try again.", "cross_site");

/**
 * Blocks cross-site form posts (login CSRF): the routes that set or clear the session cookie must be
 * called by ÖRZA's own pages. Browsers send `Sec-Fetch-Site` and `Origin` on POSTs and a page can't
 * forge them; non-browser clients (no such headers) can't ride a victim's cookies, so they pass.
 * A JSON `Content-Type` is also required — HTML forms can't send it, and a cross-origin `fetch`
 * with it needs a CORS preflight that ÖRZA never grants.
 */
export function assertSameOriginJson(req: Request) {
  const site = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (site && site !== "same-origin" && site !== "none") throw crossSite();

  const origin = req.headers.get("origin");
  if (origin) {
    const originHost = origin === "null" ? null : hostOf(origin);
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
    const allowed = new Set(
      [req.headers.get("host")?.toLowerCase(), forwardedHost, hostOf(req.url), hostOf(SITE.url)].filter(Boolean) as string[]
    );
    if (!originHost || !allowed.has(originHost)) throw crossSite();
  }

  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "Please send the request as JSON.", "unsupported_media_type");
}

/**
 * Parse a JSON body; on failure respond 400 `{ error, code: "validation", field }` with the
 * schema's own friendly message (no "path:" prefix) so the form can show it inline.
 * Also enforces {@link assertSameOriginJson}.
 */
export async function parseAuthBody<S extends ZodTypeAny>(
  req: Request,
  schema: S
): Promise<{ data: z.infer<S>; error?: undefined } | { data?: undefined; error: Response }> {
  assertSameOriginJson(req);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  const r = schema.safeParse(raw);
  if (r.success) return { data: r.data };
  const issue = r.error.issues[0];
  return {
    error: json({ error: issue?.message || "Invalid input", code: "validation", field: issue?.path?.[0] ?? null }, 400),
  };
}

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

/**
 * Check every limit and, only if all have room, record one attempt against each — atomically
 * (no await in between). Returns the seconds until the caller may try again, or 0 when the
 * attempt was allowed and recorded.
 */
export function reserve(limits: Limit[]): number {
  const now = Date.now();
  let wait = 0;
  for (const l of limits) {
    const b = live(l.key, now);
    if (b && b.hits.length >= l.limit) wait = Math.max(wait, Math.max(1, Math.ceil((b.hits[0] + l.windowMs - now) / 1000)));
  }
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

export function tooManyRequests(retryAfter: number, message: string) {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return json(
    { error: `${message} Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export const TEN_MINUTES = 10 * 60 * 1000;
export const ONE_HOUR = 60 * 60 * 1000;
