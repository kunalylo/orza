import { z } from "zod";
import { requireMobileSession } from "@/lib/auth";
import { col, newId, nowISO } from "@/lib/db";
import { EXPO_PUSH_TOKEN_RE, MAX_DEVICES_PER_USER, appDevices, deviceView, isTimeZone } from "@/lib/devices";
import { BODY_LIMIT_SMALL, json, parseBody, route } from "@/lib/http";
import { cleanDeviceLabel } from "@/lib/session-token";
import type { AppDevice, Session } from "@/lib/types";

export const dynamic = "force-dynamic";

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
});

const isDuplicateKey = (e: unknown) => (e as { code?: number } | null)?.code === 11000;

/**
 * POST /api/devices {platform: "ios"|"android", device_label, push_token?, app_version, timezone, alarms_local?}
 * → {device} (the push token is never returned; `push_token_set` says whether one is stored).
 * Phone app only (`Authorization: Bearer <app session token>`; 403 for a browser cookie). Upserts the
 * phone registered with this app session and marks it seen now — the app calls it after sign-in and
 * on every launch. While a phone with `alarms_local` (default true) was seen within 7 days, the
 * dispatcher leaves medicine-dose alarms to the app and skips Web Push for them.
 */
export const POST = route(async (req: Request) => {
  const { user, session } = await requireMobileSession();
  const input = await parseBody(req, Body, { maxBytes: BODY_LIMIT_SMALL });
  const store = appDevices();
  const now = nowISO();
  const pushToken = input.push_token || undefined;

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
    },
    ...(pushToken ? {} : { $unset: { push_token: "" } }),
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
