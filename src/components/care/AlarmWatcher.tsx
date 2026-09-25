"use client";
/**
 * In-app alarm. Mounted by AppShell on every signed-in page:
 *  - registers the service worker (/sw.js) used for Web Push;
 *  - polls GET /api/alarms/due every 30 s, on focus / when the tab becomes visible, and whenever a push
 *    arrives, and shows a full-screen alarm with the medicine's photo(s) for anything due and unacted;
 *  - medicines: Take / Snooze 10 min / Skip (POST /api/meds/doses); reminders: Done / Snooze 10 min (local);
 *  - plays a gentle repeating chime (Web Audio, unlocked on the first tap or key press), vibrates and
 *    flashes the tab title — all silent during the user's quiet hours.
 * Every failure is swallowed or toasted: the watcher must never break the app shell.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  ExternalLink,
  Pill,
  Scale,
  SkipForward,
  TimerReset,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, type DueAlarm, type DueAlarmsResponse } from "@/components/care/reminders/shared";
import { closeNotifications, registerServiceWorker } from "@/components/care/reminders/push-client";
import type { ReminderKind } from "@/lib/types";

const POLL_MS = 30_000;
const TICK_MS = 15_000;
const SNOOZE_MIN = 10;
const CHIME_EVERY_MS = 6_000;
const MAX_CHIMES = 30; // ~3 minutes, then the alarm stays on screen silently
const DISMISSED_KEY = "orza:alarms:dismissed";
const SNOOZED_KEY = "orza:alarms:snoozed";

/* ───────────────────────────── Local dismissal store ───────────────────────────── */

type DismissedMap = Record<string, number>; // alarm key → expiry (epoch ms)
type LocalSnooze = { alarm: DueAlarm; until: number };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — alarms still work for this page view */
  }
}

function loadDismissed(now = Date.now()): DismissedMap {
  const map = readJson<DismissedMap>(DISMISSED_KEY, {});
  const clean: DismissedMap = {};
  for (const [k, exp] of Object.entries(map)) if (typeof exp === "number" && exp > now) clean[k] = exp;
  return clean;
}

function loadSnoozed(now = Date.now()): LocalSnooze[] {
  const list = readJson<LocalSnooze[]>(SNOOZED_KEY, []);
  // Forget local snoozes 3 h after they were due.
  return Array.isArray(list) ? list.filter((s) => s && s.alarm && typeof s.until === "number" && s.until + 3 * 3600000 > now) : [];
}

const snoozeKey = (s: LocalSnooze) => `${s.alarm.key}~${s.until}`;

/* ───────────────────────────── Sound, vibration, title ───────────────────────────── */

type AudioCtor = typeof AudioContext;

function useChime() {
  const ctxRef = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    const unlock = () => {
      try {
        if (!ctxRef.current) {
          const AC: AudioCtor | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
          if (!AC) return;
          ctxRef.current = new AC();
        }
        const ctx = ctxRef.current;
        if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
        if (ctx.state === "running") events.forEach((e) => window.removeEventListener(e, unlock));
      } catch {
        /* audio unavailable */
      }
    };
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, unlock));
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (ctx) void ctx.close().catch(() => undefined);
    };
  }, []);

  return React.useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined); // may be refused until the next tap
      return;
    }
    if (ctx.state !== "running") return;
    try {
      const t0 = ctx.currentTime + 0.03;
      // A soft rising three-note bell (E5 · B5 · E6).
      [659.25, 987.77, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t0 + i * 0.2;
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.2);
      });
    } catch {
      /* ignore */
    }
  }, []);
}

function vibrate(pattern: number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not allowed without a user gesture on some browsers */
  }
}

function useTitleFlash(text: string | null) {
  React.useEffect(() => {
    if (!text) return;
    let base = document.title;
    let flashing = false;
    const flash = `● ${text}`;
    const id = window.setInterval(() => {
      if (!flashing) {
        base = document.title === flash ? base : document.title;
        document.title = flash;
      } else {
        document.title = base;
      }
      flashing = !flashing;
    }, 1200);
    return () => {
      window.clearInterval(id);
      if (document.title === flash) document.title = base;
    };
  }, [text]);
}

/* ───────────────────────────── Alarm feed ───────────────────────────── */

function useAlarmFeed(enabled: boolean) {
  const [server, setServer] = React.useState<DueAlarm[]>([]);
  const [quiet, setQuiet] = React.useState(false);
  const [version, setVersion] = React.useState(0); // bumps when local dismissals / snoozes change
  const [tick, setTick] = React.useState(0);
  const inflight = React.useRef(false);
  const stopped = React.useRef(false);

  const poll = React.useCallback(async () => {
    if (!enabled || inflight.current || stopped.current) return;
    inflight.current = true;
    try {
      const res = await fetch("/api/alarms/due", { credentials: "same-origin", cache: "no-store" });
      if (res.status === 401) {
        stopped.current = true; // signed out in another tab — the page itself will handle it
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as DueAlarmsResponse;
      setServer(Array.isArray(data.alarms) ? data.alarms : []);
      setQuiet(!!data.quiet);
    } catch {
      /* offline — keep what we have */
    } finally {
      inflight.current = false;
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) {
      setServer([]); // e.g. on the alarm page — don't flash stale alarms when coming back
      return;
    }
    void poll();
    const pollId = window.setInterval(() => void poll(), POLL_MS);
    const tickId = window.setInterval(() => setTick((t) => t + 1), TICK_MS);
    const onFocus = () => void poll();
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    // Other screens (Medicines, the alarm page) announce dose changes so the overlay stays in sync.
    const onDoseUpdated = () => void poll();
    window.addEventListener("focus", onFocus);
    window.addEventListener("orza:dose-updated", onDoseUpdated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(tickId);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("orza:dose-updated", onDoseUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, poll]);

  const alarms = React.useMemo(() => {
    void tick;
    void version;
    if (typeof window === "undefined") return [] as DueAlarm[];
    const now = Date.now();
    const dismissed = loadDismissed(now);
    const out = server.filter((a) => !dismissed[a.key]);
    const keys = new Set(out.map((a) => a.key));
    for (const s of loadSnoozed(now)) {
      const key = snoozeKey(s);
      if (s.until <= now && !dismissed[key] && !keys.has(key)) out.push({ ...s.alarm, key });
    }
    return out;
  }, [server, tick, version]);

  const dismiss = React.useCallback((keys: string[], forMs: number) => {
    const map = loadDismissed();
    const exp = Date.now() + forMs;
    for (const k of keys) map[k] = Math.max(map[k] || 0, exp);
    writeJson(DISMISSED_KEY, map);
    setVersion((v) => v + 1);
  }, []);

  const snoozeLocally = React.useCallback((alarm: DueAlarm, minutes: number) => {
    const baseKey = alarm.key.split("~")[0];
    const list = loadSnoozed().filter((s) => s.alarm.key !== baseKey);
    list.push({ alarm: { ...alarm, key: baseKey }, until: Date.now() + minutes * 60000 });
    writeJson(SNOOZED_KEY, list.slice(-30));
    // Hide the current appearance (and the server's copy) until the snooze ends.
    const map = loadDismissed();
    const exp = Date.now() + 3 * 3600000;
    map[alarm.key] = exp;
    map[baseKey] = exp;
    writeJson(DISMISSED_KEY, map);
    setVersion((v) => v + 1);
  }, []);

  const clearLocalSnooze = React.useCallback((alarm: DueAlarm) => {
    const baseKey = alarm.key.split("~")[0];
    writeJson(
      SNOOZED_KEY,
      loadSnoozed().filter((s) => s.alarm.key !== baseKey)
    );
    setVersion((v) => v + 1);
  }, []);

  const removeFromServerList = React.useCallback((ids: string[]) => {
    setServer((list) => list.filter((a) => !ids.includes(a.id)));
  }, []);

  return { alarms, quiet, poll, dismiss, snoozeLocally, clearLocalSnooze, removeFromServerList };
}

/* ───────────────────────────── Watcher ───────────────────────────── */

export function AlarmWatcher() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const onAlarmPage = pathname.startsWith("/dashboard/alarm");
  const feed = useAlarmFeed(!onAlarmPage);
  const { poll } = feed;
  const chime = useChime();

  // Service worker: registered once for Web Push; it pings us when a push arrives or a dose is handled.
  React.useEffect(() => {
    void registerServiceWorker();
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; url?: string } | null;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === "orza:push") void poll();
      if (msg.type === "orza:dose") window.dispatchEvent(new CustomEvent("orza:dose-updated")); // re-polls too
      if (msg.type === "orza:navigate" && typeof msg.url === "string") {
        try {
          const u = new URL(msg.url, window.location.origin);
          if (u.origin === window.location.origin) router.push(u.pathname + u.search + u.hash);
        } catch {
          /* ignore */
        }
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [poll, router]);

  const alarms = onAlarmPage ? [] : feed.alarms;
  const open = alarms.length > 0;
  const quiet = feed.quiet;

  // Ring: chime + vibration every few seconds for a few minutes (never in quiet hours).
  const ringKey = alarms.map((a) => a.key).join("|");
  React.useEffect(() => {
    if (!open || quiet) return;
    let count = 0;
    const ring = () => {
      if (count++ >= MAX_CHIMES) return;
      chime();
      vibrate([250, 120, 250, 120, 500]);
    };
    ring();
    const id = window.setInterval(ring, CHIME_EVERY_MS);
    return () => window.clearInterval(id);
  }, [open, quiet, ringKey, chime]);

  useTitleFlash(open ? alarms[0].title : null);

  if (!open) return null;
  return <AlarmOverlay alarms={alarms} quiet={quiet} feed={feed} />;
}

/* ───────────────────────────── Overlay ───────────────────────────── */

const REMINDER_ICON: Record<ReminderKind, React.ElementType> = {
  meal: UtensilsCrossed,
  water: Droplets,
  weight: Scale,
  custom: Bell,
};

type Feed = ReturnType<typeof useAlarmFeed>;
type Busy = null | "take" | "snooze" | "skip" | "all";

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function AlarmOverlay({ alarms, quiet, feed }: { alarms: DueAlarm[]; quiet: boolean; feed: Feed }) {
  const [index, setIndex] = React.useState(0);
  const [busy, setBusy] = React.useState<Busy>(null);
  const [photo, setPhoto] = React.useState(0);
  const [broken, setBroken] = React.useState<Record<string, boolean>>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const primaryRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  const safeIndex = Math.min(index, alarms.length - 1);
  const alarm = alarms[safeIndex];
  const medAlarms = alarms.filter((a) => a.kind === "medication");

  React.useEffect(() => setPhoto(0), [alarm.key]);

  // Focus management + scroll lock while the alarm is up.
  React.useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => primaryRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = overflow;
      if (previous && document.contains(previous)) previous.focus?.();
    };
  }, []);

  React.useEffect(() => {
    primaryRef.current?.focus();
  }, [alarm.key]);

  const doseAction = React.useCallback(
    async (a: DueAlarm, action: "take" | "skip" | "snooze") => {
      if (!a.medication_id) return;
      try {
        await api.post("/meds/doses", {
          medication_id: a.medication_id,
          scheduled_for: a.scheduled_for,
          action,
          ...(action === "snooze" ? { snooze_minutes: SNOOZE_MIN } : {}),
        });
      } catch (e) {
        // The medicine was deleted or its schedule changed — this alarm can't be acted on any more.
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) {
          feed.dismiss([a.key], 12 * 3600000);
          feed.removeFromServerList([a.id]);
        }
        throw e;
      }
      // Snoozed doses come back with a new key; taken / skipped ones are gone for good.
      feed.dismiss([a.key], action === "snooze" ? 3 * 3600000 : 12 * 3600000);
      feed.removeFromServerList([a.id]);
      void closeNotifications(`dose:${a.medication_id}:${a.scheduled_for}`);
      window.dispatchEvent(new CustomEvent("orza:dose-updated"));
    },
    [feed]
  );

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const label = [alarm.name, alarm.strength].filter(Boolean).join(" ") || alarm.title;

  const onTake = () =>
    run("take", async () => {
      await doseAction(alarm, "take");
      toast.success(`${label} marked as taken`);
    });
  const onSkip = () =>
    run("skip", async () => {
      await doseAction(alarm, "skip");
      toast(`${label} skipped`);
    });
  const onSnooze = () =>
    run("snooze", async () => {
      await doseAction(alarm, "snooze");
      toast(`Snoozed for ${SNOOZE_MIN} minutes`);
    });
  const onTakeAll = () =>
    run("all", async () => {
      let done = 0;
      for (const a of medAlarms) {
        await doseAction(a, "take");
        done++;
      }
      toast.success(done === 1 ? "Marked as taken" : `${done} medicines marked as taken`);
    });

  const onReminderDone = () => {
    feed.dismiss([alarm.key, alarm.key.split("~")[0]], 6 * 3600000);
    feed.clearLocalSnooze(alarm);
    toast.success("Done — nicely handled");
  };
  const onReminderSnooze = () => {
    feed.snoozeLocally(alarm, SNOOZE_MIN);
    toast(`We'll remind you again in ${SNOOZE_MIN} minutes`);
  };

  /** Escape / close: hide this alarm for 10 minutes without changing anything on the server. */
  const onHide = () => {
    if (alarm.kind === "reminder") feed.snoozeLocally(alarm, SNOOZE_MIN);
    else feed.dismiss([alarm.key], SNOOZE_MIN * 60000);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onHide();
      return;
    }
    if (e.key !== "Tab" || !containerRef.current) return;
    const focusable = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const photos = alarm.photo_urls.filter((u) => !broken[u]);
  const mainPhoto = photos[Math.min(photo, photos.length - 1)];
  const isMed = alarm.kind === "medication";
  const KindIcon = isMed ? Pill : REMINDER_ICON[alarm.reminder_kind || "custom"] || Bell;
  const eyebrow = isMed
    ? `${alarm.snoozed ? "Snoozed dose" : "Medicine alarm"} · ${formatTime(alarm.local_time)}`
    : `${KIND_LABEL[alarm.reminder_kind || "custom"]} reminder · ${formatTime(alarm.local_time)}`;

  return (
    <div
      ref={containerRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[80] overflow-y-auto bg-orza-hero text-orza-inverse orza-hero-grain print:hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-60 motion-safe:animate-orza-pulse"
        style={{ background: "radial-gradient(circle at 45% 40%, rgba(255,180,84,0.45) 0%, rgba(255,122,106,0.25) 35%, rgba(255,95,162,0.10) 60%, rgba(0,0,0,0) 72%)", filter: "blur(10px)" }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-[560px] flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+16px)] sm:px-6 sm:pt-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[12px] uppercase tracking-[0.14em] text-white/70">
            <span className="relative inline-flex h-2.5 w-2.5 shrink-0" aria-hidden>
              <span className="absolute inline-flex h-full w-full rounded-full bg-orza-coral opacity-70 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orza-coral" />
            </span>
            <span className="truncate">{eyebrow}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {alarms.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i - 1 + alarms.length) % alarms.length)}
                  aria-label="Previous alarm"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
                >
                  <ChevronLeft size={18} aria-hidden />
                </button>
                <span className="min-w-[44px] text-center font-mono text-[12px] tabular-nums text-white/70" aria-live="polite">
                  {safeIndex + 1} of {alarms.length}
                </span>
                <button
                  type="button"
                  onClick={() => setIndex((i) => (i + 1) % alarms.length)}
                  aria-label="Next alarm"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
                >
                  <ChevronRight size={18} aria-hidden />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onHide}
              aria-label={`Hide for ${SNOOZE_MIN} minutes`}
              title={`Hide for ${SNOOZE_MIN} minutes`}
              className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
            >
              <X size={17} aria-hidden />
            </button>
          </div>
        </div>

        {/* Picture */}
        <div className="mt-6 flex flex-1 flex-col items-center justify-center">
          {mainPhoto ? (
            <div className="relative aspect-square w-full max-w-[min(100%,44vh)] overflow-hidden rounded-orza-xl border border-white/15 bg-white/5 shadow-[0_30px_90px_rgba(255,122,106,0.25)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={mainPhoto}
                src={mainPhoto}
                alt={`Photo of ${label}`}
                className="h-full w-full object-cover"
                onError={() => setBroken((b) => ({ ...b, [mainPhoto]: true }))}
              />
            </div>
          ) : (
            <div className="flex aspect-square w-full max-w-[min(70%,30vh)] items-center justify-center rounded-full bg-orza-energy shadow-[0_30px_90px_rgba(255,122,106,0.35)]">
              <KindIcon className="h-[38%] w-[38%] text-white" strokeWidth={1.5} aria-hidden />
            </div>
          )}
          {photos.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Photos">
              {photos.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setPhoto(i)}
                  aria-label={`Show photo ${i + 1} of ${photos.length}`}
                  aria-pressed={u === mainPhoto}
                  className={cn(
                    "h-14 w-14 overflow-hidden rounded-orza-sm border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan",
                    u === mainPhoto ? "border-orza-amber" : "border-white/15 opacity-70 hover:opacity-100"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-full w-full object-cover" onError={() => setBroken((b) => ({ ...b, [u]: true }))} />
                </button>
              ))}
            </div>
          )}
          {isMed && !photos.length && (
            <Link
              href="/dashboard/medicines"
              onClick={onHide}
              className="mt-3 text-[13px] text-white/60 underline decoration-white/30 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
            >
              Add a photo so you can recognise it at a glance
            </Link>
          )}
        </div>

        {/* Details */}
        <div className="mt-6 text-center">
          <h2 id={titleId} className="font-editorial text-[32px] font-semibold leading-[38px] tracking-[-0.02em] text-white sm:text-[38px] sm:leading-[46px]">
            {isMed ? label : alarm.title}
          </h2>
          <div id={descId} className="mt-2 space-y-1.5">
            {isMed ? (
              <>
                <p className="text-[17px] text-white/85">{[alarm.dose, alarm.timing_text].filter(Boolean).join(" · ") || alarm.body}</p>
                {alarm.for_person && (
                  <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[13px] text-white/85">For {alarm.for_person}</p>
                )}
                {alarm.instructions && <p className="mx-auto max-w-md text-[14px] leading-relaxed text-white/65">{alarm.instructions}</p>}
              </>
            ) : (
              <p className="mx-auto max-w-md text-[16px] leading-relaxed text-white/80">{alarm.body}</p>
            )}
            {quiet && <p className="text-[12px] text-white/50">Quiet hours are on, so this alarm is silent.</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 space-y-3">
          {isMed ? (
            <>
              <Button ref={primaryRef} variant="energy" size="lg" className="h-14 w-full text-[16px]" loading={busy === "take"} disabled={!!busy} onClick={onTake}>
                {busy !== "take" && <Check size={19} aria-hidden />} Take
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="hero-outline" size="lg" className="h-12 w-full" loading={busy === "snooze"} disabled={!!busy} onClick={onSnooze}>
                  {busy !== "snooze" && <TimerReset size={17} aria-hidden />} Snooze {SNOOZE_MIN} min
                </Button>
                <Button variant="hero-outline" size="lg" className="h-12 w-full" loading={busy === "skip"} disabled={!!busy} onClick={onSkip}>
                  {busy !== "skip" && <SkipForward size={17} aria-hidden />} Skip
                </Button>
              </div>
              {medAlarms.length > 1 && (
                <Button variant="hero" size="md" className="w-full" loading={busy === "all"} disabled={!!busy} onClick={onTakeAll}>
                  Take all {medAlarms.length} medicines
                </Button>
              )}
            </>
          ) : (
            <>
              <Button ref={primaryRef} variant="energy" size="lg" className="h-14 w-full text-[16px]" onClick={onReminderDone}>
                <Check size={19} aria-hidden /> Done
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="hero-outline" size="lg" className="h-12 w-full" onClick={onReminderSnooze}>
                  <TimerReset size={17} aria-hidden /> Snooze {SNOOZE_MIN} min
                </Button>
                <Link
                  href={alarm.url}
                  onClick={onReminderDone}
                  className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-full border border-white/25 px-6 text-sm font-medium text-white/85 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
                >
                  <ExternalLink size={16} aria-hidden /> Open
                </Link>
              </div>
            </>
          )}
          {isMed && (
            <p className="pt-1 text-center">
              <Link
                href={alarm.url}
                className="text-[13px] text-white/55 underline decoration-white/25 underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
              >
                Open the full alarm page
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
