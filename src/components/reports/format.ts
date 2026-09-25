import { kgToUnit, weightUnit } from "@/components/goals/goal-math";
import { addDays } from "@/lib/dates";
import type { DailyReport, WeeklyReport } from "@/lib/reports";

export type { DailyReport, WeeklyReport, WeeklyDay, ScorePart } from "@/lib/reports";

const utc = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmtDate = (date: string, opts: Intl.DateTimeFormatOptions) => utc(date).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

export const weekdayShort = (date: string) => fmtDate(date, { weekday: "short" });
export const weekdayLong = (date: string) => fmtDate(date, { weekday: "long" });
export const dayOfMonth = (date: string) => Number(date.slice(8, 10));
/** "24 Sep" */
export const dayMonth = (date: string) => fmtDate(date, { day: "numeric", month: "short" });
/** "Wednesday, 24 September 2026" */
export const longDate = (date: string) => fmtDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** "Today" / "Yesterday" / "Mon, 22 Sep" (+ year when it isn't this year). */
export function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  if (date.slice(0, 4) !== today.slice(0, 4)) opts.year = "numeric";
  return fmtDate(date, opts);
}

/** "18 – 24 Sep 2026", "28 Sep – 4 Oct 2026", "29 Dec 2025 – 4 Jan 2026". */
export function rangeLabel(start: string, end: string) {
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  const endStr = fmtDate(end, { day: "numeric", month: "short", year: "numeric" });
  const startStr = sameMonth
    ? fmtDate(start, { day: "numeric" })
    : fmtDate(start, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export const MEAL_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

/** Short friendly line under the day score (never a judgment of food). */
export function scoreMood(r: Pick<DailyReport, "score" | "meals" | "tracking">) {
  if (!r.meals.length && !r.tracking.water_glasses && !r.tracking.steps) return "Nothing logged yet";
  if (r.score >= 80) return "Beautifully balanced";
  if (r.score >= 60) return "Nicely on track";
  if (r.score >= 35) return "Building momentum";
  return "Every day is a fresh start";
}

/* ───────────────────────────── CSV export ───────────────────────────── */

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Weekly data as CSV (one row per day, then averages and targets). Weights in kg, or lb when `imperial`. */
export function weeklyCsv(w: WeeklyReport, imperial = false): string {
  const header = ["Date", "Day", "Calories (kcal)", "Protein (g)", "Carbs (g)", "Fat (g)", "Fibre (g)", "Water (glasses)", "Steps", `Weight (${weightUnit(imperial)})`, "Meals logged", "Day score"];
  const rows: (string | number | null | undefined)[][] = w.days.map((d) => [
    d.date,
    weekdayShort(d.date),
    d.calories,
    d.protein_g,
    d.carbs_g,
    d.fat_g,
    d.fiber_g,
    d.water_glasses,
    d.steps,
    d.weight_kg != null ? kgToUnit(d.weight_kg, imperial) : "",
    d.meals_count,
    d.meals_count ? d.score : "",
  ]);
  const a = w.averages;
  const t = w.targets;
  rows.push([]);
  rows.push(["Average (logged days)", "", a.calories, a.protein_g, a.carbs_g, a.fat_g, a.fiber_g, a.water_glasses, a.steps, w.weight ? kgToUnit(w.weight.last, imperial) : "", w.logged_days, ""]);
  rows.push(["Daily target", "", t.calories, t.protein_g, t.carbs_g, t.fat_g, t.fiber_g, t.water_glasses, t.steps, "", "", ""]);
  rows.push([]);
  rows.push(["Days within ±10% of calorie target", "", w.adherence]);
  rows.push(["Summary", "", w.summary]);
  rows.push(["Note", "", "Self-logged wellness data from ÖRZA. Estimates only — not a medical record."]);
  // BOM so Excel opens the UTF-8 file (ÖRZA, ±) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
