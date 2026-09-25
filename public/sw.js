/*
 * ÖRZA service worker — shows Web Push notifications for medicine alarms and reminders.
 *
 * push                    → system notification with the medicine photo, Take / Snooze actions, deep link
 * notificationclick       → "take" / "snooze" record the dose via /api/meds/doses; otherwise focus ÖRZA
 *                           (or open it) on the notification's page
 * pushsubscriptionchange  → re-subscribe and tell the server about the new endpoint
 *
 * Plain JavaScript on purpose: this file is served as-is from /sw.js (scope "/").
 */
/* eslint-disable no-restricted-globals */
"use strict";

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-72.png";
const SNOOZE_MINUTES = 10;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** Resolve a (possibly relative) URL against this origin; null for other origins or garbage. */
function sameOrigin(url, fallback) {
  try {
    const u = new URL(url || fallback, self.location.origin);
    return u.origin === self.location.origin ? u.href : new URL(fallback, self.location.origin).href;
  } catch (e) {
    return new URL(fallback, self.location.origin).href;
  }
}

function absolute(url) {
  if (!url) return undefined;
  try {
    return new URL(url, self.location.origin).href;
  } catch (e) {
    return undefined;
  }
}

async function windowClients() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true });
}

/** Tell open ÖRZA tabs something happened (the in-app alarm refreshes right away). */
async function broadcast(message) {
  try {
    const clients = await windowClients();
    for (const c of clients) c.postMessage(message);
  } catch (e) {
    /* no open tabs */
  }
}

function maxActions() {
  try {
    if (typeof Notification !== "undefined" && typeof Notification.maxActions === "number") return Notification.maxActions;
  } catch (e) {
    /* ignore */
  }
  return 2;
}

function parsePayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch (e) {
    try {
      return { body: event.data.text() };
    } catch (e2) {
      return {};
    }
  }
}

self.addEventListener("push", (event) => {
  const p = parsePayload(event);
  const title = typeof p.title === "string" && p.title ? p.title : "ÖRZA";
  const data = Object.assign({ url: "/dashboard" }, p.data && typeof p.data === "object" ? p.data : {});
  const tag = typeof p.tag === "string" && p.tag ? p.tag : undefined;
  const silent = !!p.silent;

  const options = {
    body: typeof p.body === "string" ? p.body : "",
    icon: absolute(p.icon) || ICON,
    badge: BADGE,
    data,
    timestamp: typeof p.timestamp === "number" ? p.timestamp : Date.now(),
    requireInteraction: !!p.requireInteraction,
    silent,
  };
  const image = absolute(p.image);
  if (image) options.image = image;
  if (tag) {
    options.tag = tag;
    options.renotify = !!p.renotify; // renotify without a tag throws
  }
  if (!silent && Array.isArray(p.vibrate)) options.vibrate = p.vibrate; // vibrate + silent throws
  if (Array.isArray(p.actions) && p.actions.length) {
    options.actions = p.actions
      .filter((a) => a && typeof a.action === "string" && typeof a.title === "string")
      .slice(0, maxActions())
      .map((a) => ({ action: a.action, title: a.title }));
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options).catch(() =>
        // Some browsers reject options they don't support — fall back to the basics.
        self.registration.showNotification(title, { body: options.body, icon: ICON, badge: BADGE, tag, data })
      ),
      broadcast({ type: "orza:push", data }),
    ])
  );
});

/** Record Take / Snooze for a dose. Resolves true when the server accepted it. */
async function doseAction(data, action) {
  try {
    const body = { medication_id: data.medication_id, scheduled_for: data.scheduled_for, action };
    if (action === "snooze") body.snooze_minutes = SNOOZE_MINUTES;
    const res = await fetch("/api/meds/doses", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/** Focus an open ÖRZA tab and take it to `url`, or open a new window. */
async function openUrl(url) {
  const target = sameOrigin(url, "/dashboard");
  const clients = await windowClients();

  const exact = clients.find((c) => c.url === target);
  if (exact && "focus" in exact) return exact.focus();

  const mine = clients.find((c) => {
    try {
      return new URL(c.url).origin === self.location.origin;
    } catch (e) {
      return false;
    }
  });
  if (mine && "focus" in mine) {
    let focused = mine;
    try {
      focused = (await mine.focus()) || mine;
    } catch (e) {
      /* focus can fail without a user gesture on some platforms */
    }
    try {
      if ("navigate" in focused) {
        const navigated = await focused.navigate(target);
        if (navigated) return navigated;
      }
    } catch (e) {
      /* uncontrolled tab — ask the page to navigate itself */
    }
    focused.postMessage({ type: "orza:navigate", url: target });
    return focused;
  }
  if (self.clients.openWindow) return self.clients.openWindow(target);
  return undefined;
}

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;
  notification.close();

  const isDoseAction =
    (action === "take" || action === "snooze") && data.kind === "medication" && data.medication_id && data.scheduled_for;

  if (isDoseAction) {
    event.waitUntil(
      doseAction(data, action).then((ok) => {
        if (ok) return broadcast({ type: "orza:dose", action, medication_id: data.medication_id, scheduled_for: data.scheduled_for });
        // Signed out or offline: open the alarm so the person can act there.
        return openUrl(data.url);
      })
    );
    return;
  }

  event.waitUntil(openUrl(data.url));
});

/* ─────────────── Subscription renewal (browsers rotate endpoints occasionally) ─────────────── */

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function serverKey(oldSubscription) {
  const fromOld = oldSubscription && oldSubscription.options && oldSubscription.options.applicationServerKey;
  if (fromOld) return fromOld;
  try {
    const res = await fetch("/api/integrations", { credentials: "same-origin" });
    if (!res.ok) return null;
    const info = await res.json();
    return info && info.push && info.push.public_key ? urlBase64ToUint8Array(info.push.public_key) : null;
  } catch (e) {
    return null;
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || null;
      let sub = event.newSubscription || null;
      if (!sub) {
        const key = await serverKey(old);
        if (!key) return;
        sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (old && old.endpoint && old.endpoint !== json.endpoint) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: old.endpoint }),
        });
      }
    })().catch(() => undefined)
  );
});
