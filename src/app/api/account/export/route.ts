import { requireUser, toPublicUser } from "@/lib/auth";
import { col, type CollectionName } from "@/lib/db";
import { dateInTz } from "@/lib/dates";
import { route } from "@/lib/http";
import { SITE } from "@/lib/site";
import type { AppDevice, Media, PushSubscriptionDoc, Session } from "@/lib/types";
import { CREDIT_REQUEST_TYPE, LEGACY_CREDIT_REQUEST_SOURCE, creditRequests, toOwnView } from "../../credits/requests";
import { externalState } from "../../calendar/_lib/external";

export const dynamic = "force-dynamic";

/** Every per-user collection, keyed by its name in the export file. */
const USER_COLLECTIONS: { key: string; name: CollectionName; sort: string }[] = [
  { key: "meals", name: "meals", sort: "created_at" },
  { key: "scans", name: "scans", sort: "created_at" },
  { key: "tracking", name: "tracking", sort: "date" },
  { key: "chat_sessions", name: "chat_sessions", sort: "created_at" },
  { key: "chat_messages", name: "chat_messages", sort: "created_at" },
  { key: "goals", name: "goals", sort: "created_at" },
  { key: "compensation_plans", name: "compensation_plans", sort: "created_at" },
  { key: "recipes", name: "recipes", sort: "created_at" },
  { key: "credit_transactions", name: "credit_transactions", sort: "created_at" },
  { key: "onboarding", name: "onboarding", sort: "updated_at" },
  { key: "medications", name: "medications", sort: "created_at" },
  { key: "prescriptions", name: "prescriptions", sort: "created_at" },
  { key: "dose_logs", name: "dose_logs", sort: "scheduled_for" },
  { key: "reminders", name: "reminders", sort: "created_at" },
  { key: "dispatches", name: "dispatches", sort: "created_at" },
  { key: "health_days", name: "health_days", sort: "date" },
];

/**
 * Photos are listed without their image bytes (a few photos would push the file past what a single
 * download can carry); each entry has the in-app URL to save it from while signed in.
 */
function photoEntry(m: Media) {
  return { id: m.id, kind: m.kind, mime: m.mime, bytes: m.bytes, width: m.width, height: m.height, created_at: m.created_at, url: `/api/media/${m.id}` };
}

/** Notification devices, without the browser's private push keys. */
function deviceEntry(p: PushSubscriptionDoc) {
  return { id: p.id, endpoint: p.endpoint, user_agent: p.user_agent, created_at: p.created_at };
}

/** Phones running the ÖRZA app, without their push token (a credential). */
function appDeviceEntry(d: AppDevice) {
  return {
    id: d.id,
    platform: d.platform,
    label: d.label,
    app_version: d.app_version,
    timezone: d.timezone,
    alarms_local: d.alarms_local,
    push_notifications: !!d.push_token,
    last_seen_at: d.last_seen_at,
    created_at: d.created_at,
  };
}

/** Signed-in browsers and phone apps: when each sign-in started and expires (session ids stay server-side). */
function sessionEntry(s: Session) {
  return {
    kind: s.kind ?? "web",
    ...(s.device_label ? { device: s.device_label } : {}),
    ...(s.platform ? { platform: s.platform } : {}),
    signed_in_at: s.created_at,
    expires_at: s.expires_at,
  };
}

/**
 * GET /api/account/export → JSON attachment with everything ÖRZA stores about the signed-in user
 * (the public user record plus all their meals, scans, tracking, chats, goals, plans, recipes,
 * credit history, credit requests, onboarding answers, medicines, prescriptions, dose history,
 * reminders, sent alerts, health data, photo list, notification devices, phones running the ÖRZA app
 * and signed-in sessions). Never includes the password hash, the health-sync token hash or other
 * integration secrets (see toPublicUser), image bytes, push encryption keys, app push tokens or session ids.
 */
export const GET = route(async () => {
  const user = await requireUser();

  const entries = await Promise.all(
    USER_COLLECTIONS.map(async ({ key, name, sort }) => {
      const rows = await col<{ id: string }>(name).find({ user_id: user.id }, { sort: { [sort]: 1 } });
      return [key, rows] as const;
    })
  );
  const [photos, devices, appDevices, sessions, requests, legacyRequests] = await Promise.all([
    col<Media>("media").find({ user_id: user.id }, { sort: { created_at: 1 } }),
    col<PushSubscriptionDoc>("push_subscriptions").find({ user_id: user.id }, { sort: { created_at: 1 } }),
    col<AppDevice>("devices").find({ user_id: user.id }, { sort: { created_at: 1 } }),
    col<Session>("sessions").find({ user_id: user.id }, { sort: { created_at: 1 } }),
    // "Request more credits" messages sent from the account.
    creditRequests().find({ type: CREDIT_REQUEST_TYPE, user_id: user.id }, { sort: { created_at: 1 } }),
    // Older requests from before sign-in was required, stored under the account email.
    col<{ id: string; message?: string; created_at: string; updated_at?: string }>("leads").find(
      { email: (user.email || "").toLowerCase(), source: LEGACY_CREDIT_REQUEST_SOURCE },
      { sort: { created_at: 1 } }
    ),
  ]);
  const all: (readonly [string, unknown[]])[] = [
    ...entries,
    ["photos", photos.map(photoEntry)],
    ["notification_devices", devices.map(deviceEntry)],
    ["app_devices", appDevices.map(appDeviceEntry)],
    ["signed_in_sessions", sessions.map(sessionEntry)],
    ["credit_requests", requests.map(toOwnView)],
    [
      "credit_requests_by_email",
      legacyRequests.map((l) => ({ id: l.id, message: l.message ?? "", created_at: l.created_at, updated_at: l.updated_at ?? null })),
    ],
  ];
  const data = Object.fromEntries(all);

  const payload = {
    export: {
      app: SITE.name,
      format_version: 1,
      generated_at: new Date().toISOString(),
      note:
        "This file contains all the personal data ÖRZA stores for your account. Keep it somewhere safe. " +
        "Photos are listed without image data; open each photo's url in ÖRZA while signed in to save a copy. " +
        "credit_requests_by_email are messages received for your email address before requests required signing in.",
      counts: Object.fromEntries(all.map(([k, rows]) => [k, rows.length])),
    },
    user: toPublicUser(user),
    // Calendar links are credentials, so they are described rather than copied (toPublicUser omits them).
    calendar_connections: {
      subscription_feed: user.integrations?.calendar_token ? "active" : "off",
      external_calendar: externalState(user),
    },
    ...data,
  };

  const filename = `orza-data-${dateInTz(user.profile?.timezone)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
