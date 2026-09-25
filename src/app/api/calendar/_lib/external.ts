/**
 * Server helpers for the user's own (external) calendar link — Google "Secret address in iCal format",
 * iCloud public calendar, Outlook published ICS. Not a route.
 */
import { calendarProvider, IcalImportError, type IcalErrorCode } from "@/lib/care/ical-import";
import { HttpError } from "@/lib/http";
import type { User } from "@/lib/types";
import type { ExternalCalendarState } from "@/components/care/calendar/types";

/**
 * Masked form of the secret link for display: host + the last path segment, middle elided.
 * The full address is a credential (anyone holding it can read the calendar), so it is never echoed back.
 */
export function maskCalendarUrl(url: string): string {
  try {
    const u = new URL(url);
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1] || "";
    const tail = last.length > 24 ? `…${last.slice(-12)}` : last;
    return segs.length > 1 ? `${u.hostname}/…/${tail}` : `${u.hostname}/${tail}`;
  } catch {
    return "Calendar link";
  }
}

export function externalState(user: Pick<User, "integrations">, extra: Partial<ExternalCalendarState> = {}): ExternalCalendarState {
  const url = user.integrations?.external_ical_url;
  if (!url) return { connected: false };
  return { connected: true, provider: calendarProvider(url), url_preview: maskCalendarUrl(url), ...extra };
}

const STATUS_FOR: Record<IcalErrorCode, number> = {
  invalid_url: 400,
  blocked_host: 400,
  dns: 422,
  http: 422,
  not_ical: 422,
  too_large: 422,
  redirects: 422,
  timeout: 504,
  network: 502,
};

/** Convert an import failure into an HttpError the route wrapper turns into `{error, code}`. */
export function importErrorToHttp(e: unknown): HttpError {
  if (e instanceof IcalImportError) return new HttpError(STATUS_FOR[e.code] || 422, e.message, `calendar_${e.code}`);
  if (e instanceof HttpError) return e;
  return new HttpError(502, "We couldn't read that calendar right now. Please try again in a moment.", "calendar_network");
}

/** Friendly message for a failed background refresh (shown next to the calendar, not as a hard error). */
export function importErrorMessage(e: unknown): string {
  if (e instanceof IcalImportError) return e.message;
  return "We couldn't refresh your calendar right now. ÖRZA will try again shortly.";
}

/* ───────────── Per-user limiter for connect attempts (each one makes an outbound request) ───────────── */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = ((globalThis as typeof globalThis & { __orzaCalConnect?: Map<string, number[]> }).__orzaCalConnect ??= new Map());

/** Throws 429 when a user has tried to connect a calendar too often in the last 10 minutes. */
export function checkConnectRate(userId: string, now = Date.now()) {
  const recent = (attempts.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(userId, recent);
    throw new HttpError(429, "That's a lot of attempts. Please wait a few minutes before connecting a calendar again.", "rate_limited");
  }
  recent.push(now);
  attempts.set(userId, recent);
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (!v.some((t) => now - t < WINDOW_MS)) attempts.delete(k);
  }
}
