import { z } from "zod";
import { col, newId, nowISO } from "@/lib/db";
import { json, parseBody, route } from "@/lib/http";

/**
 * POST /api/leads {email, source, message?} → {ok:true}
 * Public (no auth). Newsletter sign-ups and contact messages from the marketing site.
 * Dedupes on email+source and applies a small in-memory per-IP rate limit.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lead = { id: string; email: string; source: string; message?: string; created_at: string; updated_at?: string };

const LeadSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "Email is too long").email("Please enter a valid email"),
  source: z.string().trim().min(1, "Source is required").max(40, "Source must be 40 characters or fewer"),
  message: z.string().trim().max(1000, "Message must be 1000 characters or fewer").optional(),
});

/* ───────────── rate limit: 10 requests / minute / IP (per server instance) ───────────── */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;

type Bucket = { count: number; resetAt: number };
const g = globalThis as typeof globalThis & { __orzaLeadLimits?: Map<string, Bucket> };
const buckets = (g.__orzaLeadLimits ??= new Map<string, Bucket>());

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Returns seconds to wait when limited, or 0 when the request may proceed. */
function rateLimit(ip: string): number {
  const now = Date.now();
  // Keep the map bounded: drop expired buckets once it grows.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return 0;
  }
  b.count += 1;
  return b.count > MAX_PER_WINDOW ? Math.max(1, Math.ceil((b.resetAt - now) / 1000)) : 0;
}

export const POST = route(async (req: Request) => {
  const wait = rateLimit(clientIp(req));
  if (wait) {
    return json(
      { error: "Too many requests. Please try again in a minute.", code: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(wait) } }
    );
  }

  const { email, source, message } = await parseBody(req, LeadSchema);

  // Upsert on email+source: a repeat sign-up is a silent no-op that still returns ok.
  // A repeat *message* (e.g. a second "Request more credits") replaces the stored one so the team sees it.
  const now = nowISO();
  await col<Lead>("leads").updateOne(
    { email, source },
    message
      ? { $setOnInsert: { id: newId(), created_at: now }, $set: { message, updated_at: now } }
      : { $setOnInsert: { id: newId(), created_at: now } },
    { upsert: true }
  );

  return json({ ok: true });
});
