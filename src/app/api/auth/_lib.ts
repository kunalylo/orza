/**
 * Shared helpers for the auth routes: input schemas, a small in-memory rate limiter,
 * and friendly validation responses. (Not a route — Next only routes `route.ts`.)
 */
import { z, type ZodTypeAny } from "zod";
import { badRequest, json } from "@/lib/http";

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

/**
 * Parse a JSON body; on failure respond 400 `{ error, code: "validation", field }` with the
 * schema's own friendly message (no "path:" prefix) so the form can show it inline.
 */
export async function parseAuthBody<S extends ZodTypeAny>(
  req: Request,
  schema: S
): Promise<{ data: z.infer<S>; error?: undefined } | { data?: undefined; error: Response }> {
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

/* ───────────────────────── Rate limiting ───────────────────────── */

type Buckets = Map<string, number[]>;
const g = globalThis as typeof globalThis & { __orzaAuthLimits?: Buckets };
const buckets: Buckets = (g.__orzaAuthLimits ||= new Map());

/** Best-effort client IP (first X-Forwarded-For hop on Vercel/most proxies). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "local";
}

function recent(key: string, windowMs: number, now = Date.now()) {
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length) buckets.set(key, hits);
  else buckets.delete(key);
  return hits;
}

function prune(windowMs: number) {
  if (buckets.size < 5000) return;
  const now = Date.now();
  for (const [k, hits] of buckets) if (!hits.some((t) => now - t < windowMs)) buckets.delete(k);
}

/** Seconds until the caller may try again, or 0 when under the limit. */
export function limited(key: string, limit: number, windowMs: number): number {
  const hits = recent(key, windowMs);
  if (hits.length < limit) return 0;
  return Math.max(1, Math.ceil((hits[0] + windowMs - Date.now()) / 1000));
}

export function hit(key: string, windowMs: number) {
  prune(windowMs);
  const hits = recent(key, windowMs);
  hits.push(Date.now());
  buckets.set(key, hits);
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
