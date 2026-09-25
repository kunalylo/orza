/**
 * Notification dispatcher — run every minute by /api/cron/dispatch.
 *
 * For every user with active medicines or reminders it looks at occurrences in the window
 * (now − 10 min, now] and sends each one once:
 *   - one Web Push notification PER MEDICINE dose (that medicine's photo as image + icon, Take / Snooze
 *     actions, deep link to the full-screen alarm) and, when the user opted in, a WhatsApp message
 *     with the photo;
 *   - snoozed doses again when their `snooze_until` passes;
 *   - reminders on the channels they were created with (push / WhatsApp);
 *   - a once-per-local-day low-stock refill alert (daytime only).
 * Quiet hours (integrations.quiet_hours, user's local time) suppress push and WhatsApp.
 *
 * Idempotency: before sending, a `dispatches` document with a deterministic id is claimed with an
 * insert-if-absent; a second run (or a concurrent one) finds it and skips. Results are written back
 * after sending. Dispatch records older than 14 days are deleted.
 */
import { col, nowISO } from "@/lib/db";
import { utcToZoned } from "@/lib/dates";
import { mediaUrl } from "@/lib/media";
import { dosesBetween, tzOf } from "@/lib/care/meds";
import { occurrencesBetween } from "@/lib/care/schedule";
import { pushConfigured, sendPushToSubscriptions, type PushPayload } from "@/lib/care/push";
import { publicUrl, sendWhatsApp, whatsappConfigured, type WhatsAppMessage } from "@/lib/care/whatsapp";
import { isQuietNow, whatsappTarget } from "@/lib/care/integrations";
import {
  KIND_DEFAULT_BODY,
  KIND_EMOJI,
  REMINDER_URL,
  alarmUrl,
  doseLine,
  medicineLabel,
} from "@/components/care/reminders/shared";
import type { Dispatch, DoseLog, Medication, PushSubscriptionDoc, Reminder, User } from "@/lib/types";

/** How far back an occurrence can be and still be delivered (covers a missed or late cron tick). */
export const DISPATCH_WINDOW_MIN = 10;
/** Dispatch records are kept this long for idempotency and support, then deleted. */
export const DISPATCH_RETENTION_DAYS = 14;
/** Refill alerts are only sent during the day (user's local time). */
export const REFILL_WINDOW = { from: "08:00", to: "21:00" } as const;
/** Stop starting new users after this long, so a run finishes inside a 60 s function limit. */
const RUN_BUDGET_MS = 45_000;
const USER_CONCURRENCY = 6;
const PHOTO_LINK_SECONDS = 86_400;

export interface DispatchSummary {
  /** Users with active medicines or reminders that were checked. */
  users: number;
  /** Notifications delivered on at least one channel. */
  sent: number;
  /** Occurrences not sent: already dispatched, already acted on, quiet hours, or no channel to reach the user. */
  skipped: number;
  /** Notifications where every channel failed, plus users that couldn't be processed. */
  errors: number;
  push: { sent: number; failed: number };
  whatsapp: { sent: number; failed: number };
  /** Old dispatch records deleted in this run. */
  cleaned: number;
  /** True when the time budget ran out before every user was checked (the next run continues). */
  truncated: boolean;
  duration_ms: number;
  /** A few error messages (no personal data) to make failures diagnosable from the cron log. */
  error_samples: string[];
}

interface Outgoing {
  id: string;
  source: Dispatch["source"];
  source_id: string;
  occurrence: string;
  push?: PushPayload;
  whatsapp?: WhatsAppMessage;
  /** Push TTL (seconds) — how long an offline phone should still receive it. */
  ttl: number;
  /** Quiet hours suppress it (refill alerts instead wait until quiet hours end). */
  quietBehaviour: "suppress" | "defer";
}

/* ───────────────────────────── Notification builders ───────────────────────────── */

const firstPhoto = (m: Pick<Medication, "photo_ids">) => (m.photo_ids || [])[0];

/** Push + WhatsApp content for one medicine dose. */
export function medicationNotification(
  med: Pick<Medication, "id" | "name" | "strength" | "dose" | "timing" | "for_person" | "instructions" | "photo_ids">,
  scheduledFor: string,
  localTime: string,
  opts: { snoozed?: boolean } = {}
): { push: PushPayload; whatsapp: WhatsAppMessage } {
  const label = medicineLabel(med);
  const title = `💊 Time for ${label}`;
  const body = doseLine(med) || med.dose || "Your scheduled dose";
  const photo = firstPhoto(med);
  const signed = photo ? mediaUrl(photo, PHOTO_LINK_SECONDS) : undefined;
  const url = alarmUrl(med.id, scheduledFor);
  const push: PushPayload = {
    title,
    body,
    image: signed,
    icon: signed,
    tag: `dose:${med.id}:${scheduledFor}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 600],
    timestamp: Date.parse(scheduledFor),
    actions: [
      { action: "take", title: "Taken" },
      { action: "snooze", title: "Snooze 10 min" },
    ],
    data: { url, kind: "medication", medication_id: med.id, scheduled_for: scheduledFor },
  };
  const whatsapp: WhatsAppMessage = {
    title,
    body: [body, med.instructions?.trim(), opts.snoozed ? `Snoozed dose from ${localTime}` : `Scheduled for ${localTime}`]
      .filter(Boolean)
      .join(" · "),
    imageUrl: photo ? publicUrl(mediaUrl(photo, PHOTO_LINK_SECONDS)) || undefined : undefined,
    imageCaption: label,
    link: publicUrl(url) || undefined,
  };
  return { push, whatsapp };
}

/** Push + WhatsApp content for one reminder occurrence. */
export function reminderNotification(
  r: Pick<Reminder, "id" | "kind" | "title" | "body">,
  occurrence: string
): { push: PushPayload; whatsapp: WhatsAppMessage } {
  const title = `${KIND_EMOJI[r.kind] || KIND_EMOJI.custom} ${r.title}`;
  const body = r.body?.trim() || KIND_DEFAULT_BODY[r.kind] || KIND_DEFAULT_BODY.custom;
  const url = REMINDER_URL[r.kind] || REMINDER_URL.custom;
  return {
    push: {
      title,
      body,
      tag: `reminder:${r.id}:${occurrence}`,
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      timestamp: Date.parse(occurrence),
      data: { url, kind: "reminder", reminder_id: r.id, scheduled_for: occurrence },
    },
    whatsapp: { title, body, link: publicUrl(url) || undefined },
  };
}

/** Push + WhatsApp content for a low-stock alert. */
export function refillNotification(
  med: Pick<Medication, "id" | "name" | "strength" | "for_person" | "photo_ids" | "stock">
): { push: PushPayload; whatsapp: WhatsAppMessage } {
  const label = medicineLabel(med);
  const count = Math.max(0, Math.floor(med.stock?.count ?? 0));
  const unit = med.stock?.unit?.trim() || "doses";
  const who = med.for_person?.trim() ? ` (for ${med.for_person.trim()})` : "";
  const title = count === 0 ? `💊 ${label} has run out` : `💊 Refill ${label} soon`;
  const body =
    count === 0
      ? `Your stock${who} is at zero. Reorder today so no dose is missed.`
      : `Only ${count} ${unit} left${who}. Reorder before you run out.`;
  const photo = firstPhoto(med);
  const signed = photo ? mediaUrl(photo, PHOTO_LINK_SECONDS) : undefined;
  return {
    push: {
      title,
      body,
      icon: signed,
      image: signed,
      tag: `refill:${med.id}`,
      renotify: false,
      requireInteraction: false,
      data: { url: "/dashboard/medicines", kind: "refill", medication_id: med.id },
    },
    whatsapp: {
      title,
      body,
      imageUrl: photo ? publicUrl(mediaUrl(photo, PHOTO_LINK_SECONDS)) || undefined : undefined,
      imageCaption: label,
      link: publicUrl("/dashboard/medicines") || undefined,
    },
  };
}

/* ───────────────────────────── Idempotent claim ───────────────────────────── */

const isDuplicateKey = (e: unknown) => {
  const err = e as { code?: number; message?: string } | null;
  return err?.code === 11000 || /E11000|duplicate key/i.test(err?.message || "");
};

/** Insert the dispatch record if absent. Returns true only for the run that created it. */
async function claim(doc: Dispatch): Promise<boolean> {
  const { id, ...rest } = doc;
  try {
    const r = await col<Dispatch>("dispatches").updateOne({ id }, { $setOnInsert: rest }, { upsert: true });
    return r.upserted;
  } catch (e) {
    if (isDuplicateKey(e)) return false; // a concurrent run claimed it first
    throw e;
  }
}

/* ───────────────────────────── Per-user work ───────────────────────────── */

interface Ctx {
  now: Date;
  summary: DispatchSummary;
  pushOn: boolean;
  whatsappOn: boolean;
}

function noteError(ctx: Ctx, message: string) {
  if (ctx.summary.error_samples.length < 8 && !ctx.summary.error_samples.includes(message)) ctx.summary.error_samples.push(message);
}

/** Everything due for one user in the window, before de-duplication. */
async function collectOutgoing(user: User, meds: Medication[], reminders: Reminder[], ctx: Ctx): Promise<{ items: Outgoing[]; skipped: number }> {
  const { now } = ctx;
  const tz = tzOf(user);
  const windowStart = new Date(now.getTime() - DISPATCH_WINDOW_MIN * 60000);
  const from = new Date(windowStart.getTime() + 1); // (now − 10 min, now]
  const to = new Date(now.getTime() + 1);
  const items: Outgoing[] = [];
  let skipped = 0;

  // 1. Scheduled medicine doses — one notification per medicine.
  const alarmMeds = meds.filter((m) => !m.as_needed);
  const medsById = new Map(meds.map((m) => [m.id, m]));
  if (alarmMeds.length) {
    const doses = await dosesBetween(user, from, to, now, alarmMeds);
    for (const d of doses) {
      // Any dose log means the user already acted (taken / skipped / snoozed — snoozes re-fire below).
      if (d.status !== "due" || d.acted_at) {
        skipped++;
        continue;
      }
      const med = medsById.get(d.medication_id);
      if (!med) continue;
      const n = medicationNotification(med, d.scheduled_for, d.local_time);
      items.push({
        id: `medication:${med.id}:${d.scheduled_for}`,
        source: "medication",
        source_id: med.id,
        occurrence: d.scheduled_for,
        ...n,
        ttl: 3600,
        quietBehaviour: "suppress",
      });
    }

    // 2. Snoozed doses whose snooze ended inside the window.
    const snoozed = await col<DoseLog>("dose_logs").find({
      user_id: user.id,
      status: "snoozed",
      snooze_until: { $gt: windowStart.toISOString(), $lte: now.toISOString() },
    });
    for (const log of snoozed) {
      const med = medsById.get(log.medication_id);
      if (!med || med.as_needed || !log.snooze_until) continue;
      const n = medicationNotification(med, log.scheduled_for, log.local_time, { snoozed: true });
      items.push({
        id: `medication:${med.id}:${log.scheduled_for}:snooze:${log.snooze_until}`,
        source: "medication",
        source_id: med.id,
        occurrence: log.snooze_until,
        ...n,
        ttl: 3600,
        quietBehaviour: "suppress",
      });
    }
  }

  // 3. Reminders (paused entirely when Settings → Gentle reminders is off).
  if (user.preferences?.reminders !== false) {
    for (const r of reminders) {
      if (!r.channels?.push && !r.channels?.whatsapp) continue; // calendar-only reminders ring in the phone calendar
      for (const o of occurrencesBetween(r.schedule, from, to, tz)) {
        const n = reminderNotification(r, o.iso);
        items.push({
          id: `reminder:${r.id}:${o.iso}`,
          source: "reminder",
          source_id: r.id,
          occurrence: o.iso,
          push: r.channels.push ? n.push : undefined,
          whatsapp: r.channels.whatsapp ? n.whatsapp : undefined,
          ttl: 1800,
          quietBehaviour: "suppress",
        });
      }
    }
  }

  // 4. Low-stock refill alerts — once per local day, daytime only.
  const local = utcToZoned(now, tz);
  if (local.time >= REFILL_WINDOW.from && local.time < REFILL_WINDOW.to) {
    for (const m of meds) {
      const s = m.stock;
      if (!s || typeof s.count !== "number" || typeof s.refill_alert_at !== "number") continue;
      if (s.count > s.refill_alert_at) continue;
      const n = refillNotification(m);
      items.push({
        id: `refill:${m.id}:${local.date}`,
        source: "refill",
        source_id: m.id,
        occurrence: now.toISOString(),
        ...n,
        ttl: 12 * 3600,
        quietBehaviour: "defer",
      });
    }
  }

  return { items, skipped };
}

async function dispatchForUser(user: User, meds: Medication[], reminders: Reminder[], ctx: Ctx): Promise<void> {
  const { summary, now } = ctx;
  const { items, skipped } = await collectOutgoing(user, meds, reminders, ctx);
  summary.skipped += skipped;
  if (!items.length) return;

  // Drop what an earlier run already handled (one read instead of a write attempt per item).
  const existing = await col<Dispatch>("dispatches").find({ user_id: user.id, id: { $in: items.map((i) => i.id) } });
  const done = new Set(existing.map((d) => d.id));
  const fresh = items.filter((i) => !done.has(i.id));
  summary.skipped += items.length - fresh.length;
  if (!fresh.length) return;

  let subs: PushSubscriptionDoc[] = ctx.pushOn ? await col<PushSubscriptionDoc>("push_subscriptions").find({ user_id: user.id }) : [];
  const waTo = ctx.whatsappOn ? whatsappTarget(user) : null;
  const quiet = isQuietNow(user, now);
  const dispatches = col<Dispatch>("dispatches");

  for (const item of fresh) {
    const wantPush = !!item.push && subs.length > 0;
    const wantWhatsApp = !!item.whatsapp && !!waTo;
    if (!wantPush && !wantWhatsApp) {
      summary.skipped++; // nowhere to deliver; not claimed, so it goes out if a channel is connected within the window
      continue;
    }
    if (quiet && item.quietBehaviour === "defer") {
      summary.skipped++; // refill alert waits until quiet hours end
      continue;
    }

    const doc: Dispatch = {
      id: item.id,
      user_id: user.id,
      source: item.source,
      source_id: item.source_id,
      occurrence: item.occurrence,
      channels: [],
      results: quiet ? { suppressed: "quiet hours" } : {},
      created_at: nowISO(),
    };
    if (!(await claim(doc))) {
      summary.skipped++;
      continue;
    }
    if (quiet) {
      summary.skipped++; // recorded as suppressed so it isn't sent once quiet hours end
      continue;
    }

    const channels: string[] = [];
    const results: Record<string, string> = {};
    let delivered = false;

    if (wantPush && item.push) {
      channels.push("push");
      const r = await sendPushToSubscriptions(subs, item.push, { ttl: item.ttl, urgency: "high" });
      summary.push.sent += r.sent;
      summary.push.failed += r.failed;
      if (r.removed.length) subs = subs.filter((s) => !r.removed.includes(s.endpoint));
      if (r.sent > 0) {
        delivered = true;
        results.push = r.failed ? `sent to ${r.sent} of ${r.sent + r.failed} devices` : "sent";
      } else {
        results.push = r.errors[0] || "failed";
        noteError(ctx, `push: ${results.push}`);
      }
    }

    if (wantWhatsApp && item.whatsapp && waTo) {
      channels.push("whatsapp");
      try {
        const w = await sendWhatsApp(waTo, item.whatsapp);
        summary.whatsapp.sent++;
        delivered = true;
        results.whatsapp = "sent";
        if (w.image !== "skipped") results.whatsapp_image = w.image;
      } catch (e) {
        summary.whatsapp.failed++;
        results.whatsapp = e instanceof Error ? e.message : "WhatsApp failed";
        noteError(ctx, `whatsapp: ${results.whatsapp}`);
      }
    }

    if (delivered) summary.sent++;
    else summary.errors++;
    await dispatches.updateOne({ id: item.id }, { $set: { channels, results } }).catch(() => undefined);
  }
}

/* ───────────────────────────── Entry point ───────────────────────────── */

async function pool<T>(items: T[], limit: number, shouldStop: () => boolean, fn: (item: T) => Promise<void>): Promise<boolean> {
  let next = 0;
  let stopped = false;
  const worker = async () => {
    while (next < items.length) {
      if (shouldStop()) {
        stopped = true;
        return;
      }
      await fn(items[next++]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return stopped;
}

export async function runDispatch(now: Date = new Date()): Promise<DispatchSummary> {
  const started = Date.now();
  const summary: DispatchSummary = {
    users: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    push: { sent: 0, failed: 0 },
    whatsapp: { sent: 0, failed: 0 },
    cleaned: 0,
    truncated: false,
    duration_ms: 0,
    error_samples: [],
  };
  const ctx: Ctx = { now, summary, pushOn: pushConfigured(), whatsappOn: whatsappConfigured() };

  // Housekeeping first, so it happens even when there's nothing to send.
  const cutoff = new Date(now.getTime() - DISPATCH_RETENTION_DAYS * 86400000).toISOString();
  summary.cleaned = await col<Dispatch>("dispatches")
    .deleteMany({ created_at: { $lt: cutoff } })
    .catch(() => 0);

  if (!ctx.pushOn && !ctx.whatsappOn) {
    summary.error_samples.push("No delivery channel is configured (VAPID keys and WhatsApp credentials are both missing).");
    summary.duration_ms = Date.now() - started;
    return summary;
  }

  const [meds, reminders] = await Promise.all([
    col<Medication>("medications").find({ active: true }),
    col<Reminder>("reminders").find({ active: true }),
  ]);
  const medsByUser = new Map<string, Medication[]>();
  for (const m of meds) medsByUser.set(m.user_id, [...(medsByUser.get(m.user_id) || []), m]);
  const remindersByUser = new Map<string, Reminder[]>();
  for (const r of reminders) remindersByUser.set(r.user_id, [...(remindersByUser.get(r.user_id) || []), r]);

  const userIds = [...new Set([...medsByUser.keys(), ...remindersByUser.keys()])];
  if (!userIds.length) {
    summary.duration_ms = Date.now() - started;
    return summary;
  }
  const users = await col<User>("users").find({ id: { $in: userIds } });

  summary.truncated = await pool(
    users,
    USER_CONCURRENCY,
    () => Date.now() - started > RUN_BUDGET_MS,
    async (user) => {
      summary.users++;
      try {
        await dispatchForUser(user, medsByUser.get(user.id) || [], remindersByUser.get(user.id) || [], ctx);
      } catch (e) {
        summary.errors++;
        noteError(ctx, e instanceof Error ? e.message.slice(0, 160) : "Unknown dispatch error");
        console.error("[orza] dispatch failed for a user", e);
      }
    }
  );

  summary.duration_ms = Date.now() - started;
  return summary;
}
