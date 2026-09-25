/** Display helpers for the Health sync page (pure). */
import { SOURCE_LABELS } from "./metrics";
import type { HealthSource } from "@/lib/types";

const intl = new Intl.NumberFormat("en-IN");

export const formatInt = (n: number) => intl.format(Math.round(n));

/** 432 → "7h 12m" */
export function formatSleep(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const formatKg = (kg: number) => `${(Math.round(kg * 10) / 10).toFixed(1)}`;

/** "2026-09-24" → "24 Sep" (or "24 Sep 2025" when `withYear`). */
export function formatDay(date: string, withYear = false): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "Today", "Yesterday", "Mon 22 Sep" relative to the user's today. */
export function formatRelativeDay(date: string, today: string, yesterday: string): string {
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** ISO instant → "just now", "5 min ago", "3 h ago", "2 days ago", or a date for anything older than a week. */
export function timeAgo(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Bytes → "412 MB" / "1.2 GB". */
export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export const sourceLabel = (s: HealthSource | string) => SOURCE_LABELS[s as HealthSource] ?? s;

/** Sync endpoint for instructions. Uses the configured site URL, or this origin when the config still points at localhost. */
export function syncEndpoint(siteUrl: string): string {
  let base = siteUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined" && /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base) && window.location.origin !== base) {
    base = window.location.origin;
  }
  return `${base}/api/health/sync`;
}
