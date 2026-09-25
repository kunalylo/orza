import { createHash } from "crypto";
import { clientIp } from "@/app/api/auth/_lib";
import { BODY_LIMIT_DEFAULT, HttpError, json, readJsonBody, route } from "@/lib/http";
import {
  bearerToken,
  isWellFormedHealthToken,
  parseSyncPayload,
  rateLimitExceeded,
  rateLimitHit,
  upsertHealthDays,
  userByHealthToken,
  userTz,
} from "@/lib/care/health";
import { MAX_IMPORT_DAYS } from "@/components/care/health/metrics";

export const dynamic = "force-dynamic";
/** A year of days is a few hundred upserts; give slow database round trips room. */
export const maxDuration = 60;

const HOUR = 60 * 60 * 1000;
const TEN_MINUTES = 10 * 60 * 1000;
/** Successful-auth budget per token. Automations normally post a few times a day. */
const PER_TOKEN_LIMIT = 60;
/** Wrong or revoked tokens tolerated per client IP before it has to wait. */
const BAD_TOKEN_LIMIT = 20;

const noStore = { "Cache-Control": "no-store" };

function tooMany(retryAfterSec: number, message: string) {
  return json({ error: message, code: "rate_limited" }, { status: 429, headers: { ...noStore, "Retry-After": String(retryAfterSec) } });
}

function unauthorizedSync(message: string) {
  return json({ error: message, code: "unauthorized" }, { status: 401, headers: { ...noStore, "WWW-Authenticate": 'Bearer realm="orza-health-sync"' } });
}

/**
 * POST /api/health/sync — for automation apps, Apple Shortcuts and the ÖRZA mobile app.
 * Auth: `Authorization: Bearer <health sync token>` only (session cookies are ignored).
 * Body (≤ 1 MB): ÖRZA JSON `{source?, days:[{date, steps?, active_kcal?, distance_km?, sleep_minutes?, resting_hr?, avg_hr?, weight_kg?, water_ml?}]}`
 * or the Health Auto Export app's REST payload `{data:{metrics:[…]}}`.
 * → `{ok, days_updated, skipped}`.
 */
export const POST = route(async (req: Request) => {
  const ip = clientIp(req);
  const badKey = `health-sync-bad:${ip}`;
  const blocked = rateLimitExceeded(badKey, BAD_TOKEN_LIMIT, TEN_MINUTES);
  if (blocked.exceeded) return tooMany(blocked.retryAfterSec, "Too many attempts with an invalid sync token. Please wait a few minutes.");

  const token = bearerToken(req);
  if (!token) return unauthorizedSync("Missing sync token. Send the header “Authorization: Bearer <your ÖRZA sync token>”.");

  if (!isWellFormedHealthToken(token)) {
    rateLimitHit(badKey, BAD_TOKEN_LIMIT, TEN_MINUTES);
    return unauthorizedSync("That sync token isn't valid. Generate a new one in ÖRZA → Health sync.");
  }

  const tokenKey = `health-sync:${createHash("sha256").update(token).digest("hex")}`;
  const limit = rateLimitHit(tokenKey, PER_TOKEN_LIMIT, HOUR);
  if (!limit.ok) return tooMany(limit.retryAfterSec, "This sync token has sent 60 requests in the last hour. Please sync less often — once a day is plenty.");

  const user = await userByHealthToken(token);
  if (!user) {
    rateLimitHit(badKey, BAD_TOKEN_LIMIT, TEN_MINUTES);
    return unauthorizedSync("That sync token isn't valid or was revoked. Generate a new one in ÖRZA → Health sync.");
  }

  const body = await readJsonBody(req, { maxBytes: BODY_LIMIT_DEFAULT });
  const days = (body as { days?: unknown } | null)?.days;
  if (Array.isArray(days) && days.length > MAX_IMPORT_DAYS) {
    throw new HttpError(400, `Send at most ${MAX_IMPORT_DAYS} days per request.`, "bad_request");
  }
  const parsed = parseSyncPayload(body, userTz(user));
  if (!parsed) {
    throw new HttpError(
      400,
      'Unrecognised format. Send {"source": "health_connect", "days": [{"date": "YYYY-MM-DD", "steps": 8000}]} or a Health Auto Export JSON payload.',
      "bad_request"
    );
  }

  const { days_updated } = parsed.days.length ? await upsertHealthDays(user, parsed.source, parsed.days) : { days_updated: 0 };
  return json({ ok: true, days_updated, skipped: parsed.skipped }, { headers: noStore });
});
