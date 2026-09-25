"use client";
/**
 * Browser-side Web Push helpers: feature detection (incl. the iPhone home-screen rule),
 * service-worker registration and subscribe / unsubscribe.
 */

export type PushBlocker =
  | "insecure" // not HTTPS (and not localhost)
  | "ios-install" // iPhone / iPad Safari tab: push only works for home-screen apps (iOS 16.4+)
  | "unsupported"; // browser has no service worker / Push API / Notification API

export interface PushSupport {
  supported: boolean;
  blocker?: PushBlocker;
  ios: boolean;
  standalone: boolean;
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports itself as a Mac; touch points give it away.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  } catch {
    /* ignore */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, blocker: "unsupported", ios: false, standalone: false };
  const ios = isIos();
  const standalone = isStandalone();
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!window.isSecureContext) return { supported: false, blocker: "insecure", ios, standalone };
  if (!hasApis) return { supported: false, blocker: ios && !standalone ? "ios-install" : "unsupported", ios, standalone };
  return { supported: true, ios, standalone };
}

export type PermissionState = NotificationPermission | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Register /sw.js once per page load (safe to call from several components). */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return Promise.resolve(null);
  if (!registration) {
    registration = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .catch(() => {
        registration = null;
        return null;
      });
  }
  return registration;
}

export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  if (!reg || !("pushManager" in reg)) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** The JSON body /api/push/subscribe expects. */
export function subscriptionBody(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const json = sub.toJSON();
  return { endpoint: json.endpoint || sub.endpoint, keys: { p256dh: json.keys?.p256dh || "", auth: json.keys?.auth || "" } };
}

/**
 * Ask for permission (must run inside a click handler on Safari) and subscribe this browser.
 * Throws an Error with a human-readable message when it can't.
 */
export async function subscribePush(publicKey: string): Promise<PushSubscription> {
  const support = detectPushSupport();
  if (!support.supported) {
    throw new Error(
      support.blocker === "ios-install"
        ? "On iPhone, add ÖRZA to your Home Screen first, then open it from the icon."
        : support.blocker === "insecure"
          ? "Notifications need a secure (https) connection."
          : "This browser doesn't support notifications."
    );
  }
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Notifications are blocked for ÖRZA. Allow them in your browser's site settings, then try again."
        : "Notifications weren't allowed. Tap “Enable notifications” again and choose Allow."
    );
  }
  const reg = await registerServiceWorker();
  if (!reg) throw new Error("Couldn't start ÖRZA's notification service in this browser.");
  const key = urlBase64ToUint8Array(publicKey);
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // A subscription made with a different server key can't receive our pushes — replace it.
    const current = existing.options?.applicationServerKey;
    const same =
      !current ||
      (current.byteLength === key.byteLength && new Uint8Array(current).every((b, i) => b === key[i]));
    if (same) return existing;
    await existing.unsubscribe().catch(() => false);
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** Unsubscribe this browser. Returns the old endpoint (to remove it on the server) or null. */
export async function unsubscribePush(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => false);
  return endpoint;
}

/** Close any system notification with this tag (after the dose was handled in the app). */
export async function closeNotifications(tag: string): Promise<void> {
  try {
    const reg = await registerServiceWorker();
    const list = (await reg?.getNotifications({ tag })) || [];
    for (const n of list) n.close();
  } catch {
    /* not supported */
  }
}
