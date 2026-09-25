import { z } from "zod";
import { col, newId, nowISO } from "@/lib/db";
import { BODY_LIMIT_SMALL, json, parseBody, route } from "@/lib/http";
import { ONE_MINUTE, clientIp, reserve, tooManyRequests } from "@/lib/rate-limit";

/**
 * POST /api/leads {email, source, message?} → {ok:true}
 * Public (no auth). Newsletter sign-ups and plan wait-lists from the marketing site.
 * Only known public sources are accepted — account messages such as "Request more credits" go
 * through authenticated routes (POST /api/credits/request) so nobody can send or overwrite them
 * on someone else's behalf. Dedupes on email+source (a repeat is a no-op: the first message is
 * kept, never replaced) and applies a small in-memory per-IP rate limit.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Lead = { id: string; email: string; source: string; message?: string; created_at: string; updated_at?: string };

/**
 * Public sources: the site footer newsletter, the contact form and pricing-plan wait-lists (`plan:<id>`).
 * Anything else — in particular the reserved "credits-request" family — is rejected.
 */
const PUBLIC_SOURCE = /^(?:footer|newsletter|contact|waitlist|plan:[a-z0-9][a-z0-9_-]{0,31})$/;

const LeadSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, "Email is too long").email("Please enter a valid email"),
  source: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Source is required")
    .max(40, "Source must be 40 characters or fewer")
    .regex(PUBLIC_SOURCE, "Unknown sign-up source"),
  message: z.string().trim().max(1000, "Message must be 1000 characters or fewer").optional(),
});

/* ───────────── rate limit: 10 requests / minute / IP (per server instance) ───────────── */

const LEAD_LIMIT = { limit: 10, windowMs: ONE_MINUTE };

export const POST = route(async (req: Request) => {
  // Keyed on the proxy-appended IP hop (see clientIp), which the caller can't choose.
  const wait = reserve([{ key: `lead:${clientIp(req)}`, ...LEAD_LIMIT }]);
  if (wait) return tooManyRequests(wait, "Too many requests.");

  const { email, source, message } = await parseBody(req, LeadSchema, { maxBytes: BODY_LIMIT_SMALL });

  // Upsert on email+source: a repeat is a silent no-op that still returns ok. The first message is
  // kept — an unauthenticated caller must never be able to replace what someone else wrote.
  const now = nowISO();
  await col<Lead>("leads").updateOne(
    { email, source },
    { $setOnInsert: { id: newId(), created_at: now, ...(message ? { message } : {}) } },
    { upsert: true }
  );

  return json({ ok: true });
});
