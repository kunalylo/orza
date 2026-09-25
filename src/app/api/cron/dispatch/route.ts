import { createHash, timingSafeEqual } from "crypto";
import { json, route } from "@/lib/http";
import { runDispatch } from "@/lib/care/dispatch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Constant-time comparison (hashing first makes both sides the same length). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

/**
 * GET|POST /api/cron/dispatch — sends due medicine alarms, reminders and refill alerts.
 * Auth: `Authorization: Bearer ${CRON_SECRET}` (what Vercel Cron sends) or `?secret=${CRON_SECRET}`
 * (for external schedulers such as cron-job.org). 503 when CRON_SECRET isn't configured.
 */
async function handler(req: Request): Promise<Response> {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    return json({ error: "Scheduled delivery is disabled: CRON_SECRET isn't set on this server.", code: "cron_not_configured" }, 503);
  }
  const header = req.headers.get("authorization") || "";
  const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() || "";
  let query = "";
  try {
    query = new URL(req.url).searchParams.get("secret") || "";
  } catch {
    /* no query */
  }
  const ok = (bearer && safeEqual(bearer, secret)) || (query && safeEqual(query, secret));
  if (!ok) return json({ error: "Unauthorized", code: "unauthorized" }, 401);

  const summary = await runDispatch(new Date());
  return json({ ok: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
}

// Secret-authenticated (no cookies), so schedulers may POST without an Origin or JSON body.
export const GET = route(handler, { tokenAuth: true });
export const POST = route(handler, { tokenAuth: true });
