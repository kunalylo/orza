import { z } from "zod";
import { requireMobileSession } from "@/lib/auth";
import { col, isDuplicateKey, newId, nowISO } from "@/lib/db";
import { EXPO_PUSH_TOKEN_RE, MAX_DEVICES_PER_USER, appDevices, deviceView, isTimeZone } from "@/lib/devices";
import { parseClientInstant } from "@/lib/care/meds";
import { BODY_LIMIT_SMALL, json, parseBody, route } from "@/lib/http";
import { cleanDeviceLabel } from "@/lib/session-token";
import type { AppDevice, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Epoch milliseconds sent as text ("1761800000000"). */
const EPOCH_MS_RE = /^\d{1,16}$/;

/**
 * An `alarms_local_until` value → ISO UTC, or undefined when it isn't usable: an ISO date-time with a zone, or epoch
 * milliseconds as a number or a string of digits (the app's alarm planner keeps `coveredUntil` that way).
 */
function coverageEnd(value: string | number): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  const ms = typeof value === "number" ? value : EPOCH_MS_RE.test(text) ? Number(text) : parseClientInstant(text)?.getTime();
  if (ms === undefined || !Number.isFinite(ms) || Math.abs(ms) > 8.64e15) return undefined; // beyond what a Date can hold
  return new Date(ms).toISOString();
}

const Body = z.object({
  platform: z.enum(["ios", "android"], { errorMap: () => ({ message: 'platform must be "ios" or "android"' }) }),
  device_label: z
    .string({ required_error: "device_label is required" })
    .max(200, "device_label is too long")
    .transform((s, ctx) => {
      const label = cleanDeviceLabel(s);
      if (!label) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "device_label can't be empty" });
        return z.NEVER;
      }
      return label;
    }),
  /** Expo push token; omit (or null) when the user hasn't allowed notifications — a stored one is then removed. */
  push_token: z.string().trim().max(256).regex(EXPO_PUSH_TOKEN_RE, "push_token must be an Expo push token").nullable().optional(),
  app_version: z
    .string({ required_error: "app_version is required" })
    .trim()
    .min(1, "app_version is required")
    .max(40, "app_version is too long")
    .regex(/^[A-Za-z0-9 ._+()-]+$/, "app_version has unexpected characters"),
  timezone: z
    .string({ required_error: "timezone is required" })
    .trim()
    .refine(isTimeZone, "timezone must be an IANA timezone such as Asia/Kolkata"),
  /** The app rings medicine alarms itself (default true). Send false when the phone can't (notifications denied). */
  alarms_local: z.boolean().optional(),
  /**
   * The phone's scheduled alarms cover doses before this instant (the app's `coveredUntil`: ISO with a zone, or epoch
   * ms); later doses get Web Push again. Omitted = keep the stored value; null = remove it (no limit — what older app
   * versions get). An unusable value is ignored like an omitted one (as `acted_at` on /api/meds/doses): it must never
   * stop the phone from reporting `alarms_local` and `last_seen_at`.
   */
  alarms_local_until: z
    .union([z.string().max(64), z.number()])
    .nullable()
    .optional()
    .catch(undefined)
    .transform((v) => (v == null ? v : coverageEnd(v))),
});

/**
 * POST /api/devices {platform: "ios"|"android", device_label, push_token?, app_version, timezone, alarms_local?,
 * alarms_local_until?} → {device} (the push token is never returned; `push_token_set` says whether one is stored).
 * Phone app only (`Authorization: Bearer <app session token>`; 403 for a browser cookie). Upserts the
 * phone registered with this app session and marks it seen now — the app calls it after sign-in and
 * on every launch. While a phone with `alarms_local` (default true) was seen within 7 days, the
 * dispatcher leaves medicine-dose alarms to the app and skips Web Push for them — for doses before
 * `alarms_local_until` when the phone sent one (ISO or epoch ms; omitted or unusable: the stored one stays; null removes
 * it: no limit).
 */
export const POST = route(async (req: Request) => {
  const { user, session } = await requireMobileSession();
  const input = await parseBody(req, Body, { maxBytes: BODY_LIMIT_SMALL });
  const store = appDevices();
  const now = nowISO();
  const pushToken = input.push_token || undefined;
  // Missing a dose alarm is worse than a second one: an omitted (or unusable) coverage keeps the last one the phone declared.
  const coveredUntil = input.alarms_local_until || undefined;
  const unset = { ...(pushToken ? {} : { push_token: "" }), ...(input.alarms_local_until === null ? { alarms_local_until: "" } : {}) };

  // A push token belongs to one phone, and a phone runs one app session: drop older registrations of it.
  if (pushToken) await store.deleteMany({ push_token: pushToken, session_id: { $ne: session.id } });

  const update = {
    $set: {
      platform: input.platform,
      label: input.device_label,
      app_version: input.app_version,
      timezone: input.timezone,
      alarms_local: input.alarms_local ?? true,
      last_seen_at: now,
      updated_at: now,
      ...(pushToken ? { push_token: pushToken } : {}),
      ...(coveredUntil ? { alarms_local_until: coveredUntil } : {}),
    },
    ...(Object.keys(unset).length ? { $unset: unset } : {}),
    $setOnInsert: { id: newId(), created_at: now },
  };
  const filter = { user_id: user.id, session_id: session.id };
  let device: AppDevice | null;
  try {
    device = await store.findOneAndUpdate(filter, update, { upsert: true });
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
    device = await store.findOneAndUpdate(filter, update, { upsert: true }); // a parallel first registration won the insert
  }
  if (!device) throw new Error("Device registration failed");

  // Name the app session after the phone, so signed-in sessions are recognisable.
  await col<Session>("sessions").updateOne(
    { id: session.id, user_id: user.id },
    { $set: { device_label: input.device_label, platform: input.platform } }
  );

  // Keep the most recently seen phones per account.
  const mine = await store.find({ user_id: user.id }, { sort: { last_seen_at: -1 } });
  for (const old of mine.slice(MAX_DEVICES_PER_USER)) {
    if (old.id !== device.id) await store.deleteOne({ id: old.id, user_id: user.id });
  }

  return json({ device: deviceView(device) }, { headers: { "Cache-Control": "no-store" } });
});
