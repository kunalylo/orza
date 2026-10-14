/**
 * Phones running the ÖRZA app (collection `devices`).
 *
 * The app registers itself with `POST /api/devices` after sign-in and on every launch, which keeps
 * `last_seen_at` fresh. While a phone is active (seen within {@link APP_DEVICE_ACTIVE_DAYS} days, its
 * app session still live) and rings medicine alarms itself (`alarms_local`), the dispatcher skips Web
 * Push for medicine doses so the person isn't alarmed twice. Reminders, refill alerts and WhatsApp
 * are unchanged.
 */
import { col } from "@/lib/db";
import type { AppDevice, Session } from "@/lib/types";

/** A phone that hasn't checked in for this long no longer counts as ringing alarms. */
export const APP_DEVICE_ACTIVE_DAYS = 7;
/** Newest phones kept per account; older registrations are dropped. */
export const MAX_DEVICES_PER_USER = 10;

/** Expo push token: `ExponentPushToken[…]` (or the newer `ExpoPushToken[…]`). */
export const EXPO_PUSH_TOKEN_RE = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_\-:.]{1,200}\]$/;

export const appDevices = () => col<AppDevice>("devices");

/** True for a valid IANA timezone name ("Asia/Kolkata", "UTC"). */
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64 || !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Whether this registration still rings medicine alarms on the phone (ignores whether its session is live). */
export function ringsDosesLocally(d: Pick<AppDevice, "alarms_local" | "last_seen_at">, now: Date): boolean {
  if (d.alarms_local !== true) return false;
  const seen = Date.parse(d.last_seen_at);
  if (!Number.isFinite(seen)) return false;
  return now.getTime() - seen <= APP_DEVICE_ACTIVE_DAYS * 86_400_000;
}

/**
 * True when the user has the ÖRZA app signed in on a phone that rings medicine alarms itself:
 * a device with `alarms_local`, seen within the last week, whose app session is still live.
 */
export async function appRingsDoses(userId: string, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - APP_DEVICE_ACTIVE_DAYS * 86_400_000).toISOString();
  const candidates = (await appDevices().find({ user_id: userId, alarms_local: true, last_seen_at: { $gte: since } })).filter((d) =>
    ringsDosesLocally(d, now)
  );
  if (!candidates.length) return false;
  const live = await col<Session>("sessions").countDocuments({
    user_id: userId,
    id: { $in: candidates.map((d) => d.session_id) },
    kind: "mobile",
    expires_at: { $gt: now.toISOString() },
  });
  return live > 0;
}

/** What the app gets back about a registration (never the push token). */
export function deviceView(d: AppDevice) {
  return {
    id: d.id,
    platform: d.platform,
    label: d.label,
    app_version: d.app_version,
    timezone: d.timezone,
    alarms_local: d.alarms_local,
    push_token_set: !!d.push_token,
    last_seen_at: d.last_seen_at,
    created_at: d.created_at,
  };
}
