/**
 * Per-user integration settings (User.integrations): WhatsApp number + consent, quiet hours, and the
 * read model behind GET /api/integrations that the Reminders, Calendar and Health pages share.
 */
import { col, nowISO } from "@/lib/db";
import { SITE } from "@/lib/site";
import { tzOf } from "@/lib/care/meds";
import { pushConfigured, vapidPublicKey } from "@/lib/care/push";
import { whatsappConfigured, whatsappMode } from "@/lib/care/whatsapp";
import { inQuietWindow, isHHMM, type IntegrationsView } from "@/components/care/reminders/shared";
import { utcToZoned } from "@/lib/dates";
import type { HealthDay, Integrations, PushSubscriptionDoc, User } from "@/lib/types";

export type QuietHours = { start: string; end: string };

/** The user's quiet hours, or null when unset / malformed / zero-length. */
export function quietHoursOf(user: Pick<User, "integrations">): QuietHours | null {
  const q = user.integrations?.quiet_hours;
  if (!q || !isHHMM(q.start) || !isHHMM(q.end) || q.start === q.end) return null;
  return { start: q.start, end: q.end };
}

/** Is it currently (or at `at`) inside the user's quiet hours, in their own timezone? */
export function isQuietNow(user: Pick<User, "integrations" | "profile">, at: Date = new Date()): boolean {
  const q = quietHoursOf(user);
  if (!q) return false;
  return inQuietWindow(q, utcToZoned(at, tzOf(user)).time);
}

/** WhatsApp delivery target when the user has a number and has opted in (null otherwise). */
export function whatsappTarget(user: Pick<User, "integrations">): string | null {
  const i = user.integrations;
  return i?.whatsapp_opt_in && i.whatsapp_phone ? i.whatsapp_phone : null;
}

/**
 * Origin used for links shown to the user (calendar feed). Prefers the configured public site URL;
 * falls back to the origin of the incoming request when NEXT_PUBLIC_SITE_URL isn't set.
 */
export function siteOrigin(req?: Request): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return SITE.url.replace(/\/+$/, "");
  if (req) {
    try {
      return new URL(req.url).origin;
    } catch {
      /* fall through */
    }
  }
  return SITE.url.replace(/\/+$/, "");
}

/* Per-instance cooldown for "send a test" buttons (tests hit paid / rate-limited third-party APIs). */
const lastHit = new Map<string, number>();

/** Seconds the caller still has to wait before `key` may run again (0 = go ahead, and the clock restarts). */
export function cooldownSeconds(key: string, windowMs: number, now = Date.now()): number {
  const prev = lastHit.get(key);
  if (prev && now - prev < windowMs) return Math.ceil((windowMs - (now - prev)) / 1000);
  lastHit.set(key, now);
  if (lastHit.size > 5000) {
    for (const [k, t] of lastHit) if (now - t > windowMs) lastHit.delete(k);
  }
  return 0;
}

/** Everything the integration cards need, without exposing secrets (tokens are never returned). */
export async function integrationsView(user: User, origin: string): Promise<IntegrationsView> {
  const i: Integrations = user.integrations || {};
  const [subscriptions, lastHealth] = await Promise.all([
    col<PushSubscriptionDoc>("push_subscriptions").countDocuments({ user_id: user.id }),
    col<HealthDay>("health_days").find({ user_id: user.id }, { sort: { updated_at: -1 }, limit: 1 }),
  ]);
  return {
    push: { configured: pushConfigured(), subscriptions, public_key: vapidPublicKey() },
    whatsapp: {
      configured: whatsappConfigured(),
      mode: whatsappMode(),
      phone: i.whatsapp_phone || null,
      opt_in: !!(i.whatsapp_opt_in && i.whatsapp_phone),
    },
    calendar: {
      feed_url: i.calendar_token ? `${origin}/api/calendar/feed/${encodeURIComponent(i.calendar_token)}` : null,
      external_url_set: !!i.external_ical_url,
    },
    health: {
      token_preview: i.health_token_hash && i.health_token_preview ? i.health_token_preview : null,
      last_sync: lastHealth[0]?.updated_at || null,
    },
    quiet_hours: quietHoursOf(user),
    reminders_enabled: user.preferences?.reminders !== false,
    timezone: tzOf(user),
  };
}

/**
 * Set and/or clear fields under `integrations` on the user document. Returns the updated user.
 * Only whitelisted keys are written, so callers can't touch tokens by accident.
 */
export async function updateIntegrations(
  userId: string,
  set: Partial<Pick<Integrations, "whatsapp_phone" | "whatsapp_opt_in" | "quiet_hours">>,
  unset: ("whatsapp_phone" | "whatsapp_opt_in" | "quiet_hours")[] = []
): Promise<User> {
  const $set: Record<string, unknown> = { updated_at: nowISO() };
  for (const [k, v] of Object.entries(set)) if (v !== undefined) $set[`integrations.${k}`] = v;
  const $unset: Record<string, 1> = {};
  for (const k of unset) $unset[`integrations.${k}`] = 1;
  const user = await col<User>("users").findOneAndUpdate(
    { id: userId },
    Object.keys($unset).length ? { $set, $unset } : { $set }
  );
  if (!user) throw new Error("User not found");
  return user;
}
