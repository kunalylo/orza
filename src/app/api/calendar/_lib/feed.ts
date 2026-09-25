/**
 * Server helpers for the subscribable ÖRZA care calendar (not a route).
 *
 * - Feed tokens: 32 random bytes, base64url (43 chars), stored on `users.integrations.calendar_token`.
 * - Absolute links use SITE.url (NEXT_PUBLIC_SITE_URL); when that isn't configured the request's own
 *   origin is used, so a deployment without the variable still hands out reachable links.
 * - The feed covers medication doses from 2 days ago to 30 days ahead (each with a VALARM and the photo
 *   alarm URL) plus every active reminder that has `channels.calendar` turned on.
 */
import { randomBytes } from "node:crypto";
import { col } from "@/lib/db";
import { activeMedications, dosesBetween, tzOf } from "@/lib/care/meds";
import { occurrencesBetween } from "@/lib/care/schedule";
import { buildCalendar, ICS_CALENDAR_NAME, medicationDoseEvent, reminderEvent, type IcsEvent } from "@/lib/care/ics";
import { SITE } from "@/lib/site";
import type { Reminder, User } from "@/lib/types";
import type { CalendarFeedLinks } from "@/components/care/calendar/types";

export const FEED_PAST_DAYS = 2;
export const FEED_FUTURE_DAYS = 30;
const DAY_MS = 86400000;

/** 32 random bytes → 43 base64url characters. */
export const CALENDAR_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newCalendarToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Origin used for links that leave the app (calendar feed, alarm URLs inside events). */
export function publicBaseUrl(req?: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return SITE.url.replace(/\/+$/, "");
  if (req) {
    try {
      const fwdHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
      const fwdProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const u = new URL(req.url);
      const host = fwdHost || u.host;
      const proto = fwdProto === "http" || fwdProto === "https" ? fwdProto : u.protocol.replace(":", "");
      if (host && /^[A-Za-z0-9.-]+(:\d+)?$|^\[[0-9a-fA-F:]+\](:\d+)?$/.test(host)) return `${proto}://${host}`;
    } catch {
      /* fall through */
    }
  }
  return SITE.url.replace(/\/+$/, "");
}

/** True for localhost, loopback and private-network hosts — calendar apps on a phone can't reach those. */
export function isLocalBaseUrl(base: string): boolean {
  let host = "";
  try {
    host = new URL(base).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "::1" || host === "0.0.0.0") return true;
  const v4 = host.split(".").map(Number);
  if (v4.length === 4 && v4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = v4;
    return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  return false;
}

export function feedLinks(token: string, base: string): CalendarFeedLinks {
  const feed_url = `${base}/api/calendar/feed/${token}`;
  return { feed_url, webcal_url: feed_url.replace(/^https?:\/\//i, "webcal://") };
}

/** Build the full ICS document for a user's feed. */
export async function buildUserFeed(user: User, base: string, now: Date = new Date()): Promise<string> {
  const tz = tzOf(user);
  const from = new Date(now.getTime() - FEED_PAST_DAYS * DAY_MS);
  const to = new Date(now.getTime() + FEED_FUTURE_DAYS * DAY_MS);

  const [meds, reminders] = await Promise.all([
    activeMedications(user.id),
    col<Reminder>("reminders").find({ user_id: user.id, active: true }),
  ]);
  const doses = await dosesBetween(user, from, to, now, meds);
  const updatedAt = new Map(meds.map((m) => [m.id, m.updated_at]));

  const events: IcsEvent[] = doses.map((d) => medicationDoseEvent(d, { baseUrl: base, updatedAt: updatedAt.get(d.medication_id) }));
  for (const r of reminders) {
    if (!r.channels?.calendar || !r.schedule) continue;
    for (const o of occurrencesBetween(r.schedule, from, to, tz)) events.push(reminderEvent(r, o.iso, { baseUrl: base }));
  }

  return buildCalendar({
    name: ICS_CALENDAR_NAME,
    description: "Medicine doses and reminders from ÖRZA. Each event rings at its time; open it to see the medicine's photos.",
    timezone: tz,
    events,
    stamp: now,
    color: "#FF7A6A",
  });
}
