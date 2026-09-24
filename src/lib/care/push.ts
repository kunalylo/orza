/**
 * Web Push delivery (VAPID) to the browsers a user has subscribed on /dashboard/reminders.
 * The service worker (public/sw.js) turns each payload into a system notification with the
 * medicine photo, actions and deep link. Subscriptions the push service reports as gone
 * (HTTP 404 / 410) are deleted automatically.
 */
import webpush, { WebPushError } from "web-push";
import { col } from "@/lib/db";
import { SITE } from "@/lib/site";
import type { PushSubscriptionDoc } from "@/lib/types";

/** Push services accept ~4 KB of encrypted payload; keep the JSON comfortably below that. */
export const MAX_PUSH_PAYLOAD_BYTES = 3500;
/** Upper bound of devices kept per user (oldest are dropped when exceeded). */
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

export interface PushAction {
  action: string;
  title: string;
}

/** What public/sw.js understands. Every field except `title` is optional. */
export interface PushPayload {
  title: string;
  body?: string;
  /** Large picture (Android / ChromeOS); relative URLs are resolved by the service worker. */
  image?: string;
  /** Small square picture next to the text; falls back to the ÖRZA icon in the service worker. */
  icon?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  /** Epoch ms shown as the notification time (the scheduled dose time). */
  timestamp?: number;
  actions?: PushAction[];
  data?: { url?: string; kind?: string; [key: string]: unknown };
}

export interface PushSendOptions {
  /** Seconds the push service keeps the message for an offline device. */
  ttl?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Endpoints deleted because the push service said they no longer exist. */
  removed: string[];
  errors: string[];
}

function vapid() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "").trim();
  const privateKey = (process.env.VAPID_PRIVATE_KEY || "").trim();
  const configured = (process.env.VAPID_SUBJECT || "").trim();
  // web-push requires a mailto: or https: contact for the push service operator.
  const subject = /^(mailto:|https:\/\/)/i.test(configured) ? configured : `mailto:${SITE.supportEmail}`;
  return { publicKey, privateKey, subject };
}

/** True when VAPID keys are present, so Web Push can be sent. */
export function pushConfigured(): boolean {
  const v = vapid();
  return !!(v.publicKey && v.privateKey);
}

/** The public VAPID key browsers need to subscribe (safe to expose). */
export function vapidPublicKey(): string | null {
  return vapid().publicKey || null;
}

const byteLength = (s: string) => Buffer.byteLength(s, "utf8");
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(0, n - 1)).trimEnd()}…` : s);

/**
 * Serialise a payload, shrinking it step by step until it fits MAX_PUSH_PAYLOAD_BYTES:
 * shorter body → drop the large image → drop extra data → shorter title → bare minimum.
 */
export function encodePushPayload(payload: PushPayload): string {
  const fits = (p: PushPayload) => byteLength(JSON.stringify(p)) <= MAX_PUSH_PAYLOAD_BYTES;
  let p: PushPayload = { ...payload };
  if (fits(p)) return JSON.stringify(p);
  if (p.body) p = { ...p, body: cut(p.body, 240) };
  if (fits(p)) return JSON.stringify(p);
  if (p.image) p = { ...p, image: undefined };
  if (fits(p)) return JSON.stringify(p);
  if (p.icon) p = { ...p, icon: undefined };
  if (fits(p)) return JSON.stringify(p);
  if (p.data) {
    const { url, kind, medication_id, scheduled_for } = p.data;
    p = { ...p, data: { url, kind, medication_id, scheduled_for } };
  }
  if (fits(p)) return JSON.stringify(p);
  p = { ...p, title: cut(p.title, 80), body: p.body ? cut(p.body, 120) : undefined };
  if (fits(p)) return JSON.stringify(p);
  return JSON.stringify({ title: cut(payload.title, 60), body: payload.body ? cut(payload.body, 80) : undefined, tag: payload.tag, data: { url: "/dashboard" } });
}

function describeError(e: unknown): string {
  if (e instanceof WebPushError) {
    const detail = (e.body || "").replace(/\s+/g, " ").trim().slice(0, 140);
    return `HTTP ${e.statusCode}${detail ? `: ${detail}` : ""}`;
  }
  return e instanceof Error ? e.message.slice(0, 160) : "Unknown push error";
}

/** Send one payload to the given subscriptions. Gone subscriptions (404/410) are deleted. */
export async function sendPushToSubscriptions(
  subscriptions: Pick<PushSubscriptionDoc, "endpoint" | "keys" | "user_id">[],
  payload: PushPayload,
  opts: PushSendOptions = {}
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, removed: [], errors: [] };
  if (!subscriptions.length) return result;
  const v = vapid();
  if (!v.publicKey || !v.privateKey) {
    return { ...result, failed: subscriptions.length, errors: ["Web Push isn't configured on this server (VAPID keys missing)."] };
  }
  const body = encodePushPayload(payload);
  const settled = await Promise.allSettled(
    subscriptions.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, {
        vapidDetails: { subject: v.subject, publicKey: v.publicKey, privateKey: v.privateKey },
        TTL: Math.max(0, Math.round(opts.ttl ?? 3600)),
        urgency: opts.urgency ?? "high",
        timeout: 10_000,
      })
    )
  );
  const subs = col<PushSubscriptionDoc>("push_subscriptions");
  for (let i = 0; i < settled.length; i++) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      result.sent++;
      continue;
    }
    result.failed++;
    const err = r.reason;
    if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
      const s = subscriptions[i];
      await subs.deleteOne({ endpoint: s.endpoint, user_id: s.user_id }).catch(() => 0);
      result.removed.push(s.endpoint);
      result.errors.push("A device's subscription had expired and was removed.");
    } else {
      result.errors.push(describeError(err));
    }
  }
  return result;
}

export async function listSubscriptions(userId: string): Promise<PushSubscriptionDoc[]> {
  return col<PushSubscriptionDoc>("push_subscriptions").find({ user_id: userId }, { sort: { created_at: -1 } });
}

/** Send to every device the user has subscribed. Returns how many deliveries succeeded / failed. */
export async function sendPushToUser(userId: string, payload: PushPayload, opts: PushSendOptions = {}): Promise<PushResult> {
  return sendPushToSubscriptions(await listSubscriptions(userId), payload, opts);
}
