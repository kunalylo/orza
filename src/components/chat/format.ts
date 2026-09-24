import type { MealItem, MealType } from "@/lib/types";

/** Local calendar key (browser timezone) for grouping by day. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function daysAgo(iso: string): number {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Yesterday", "Mon, 12 Sep" (+ year when not this year). */
export function dayLabel(iso: string): string {
  const n = daysAgo(iso);
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Compact stamp for the sessions list: "9:41 pm", "Yesterday", "Mon", "12 Sep". */
export function sessionStamp(iso: string): string {
  const n = daysAgo(iso);
  if (n === 0) return clockTime(iso);
  if (n === 1) return "Yesterday";
  const d = new Date(iso);
  if (n > 1 && n < 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "2-digit" }) });
}

/** "Today" / "Yesterday" / "12 Sep" for a YYYY-MM-DD meal date. */
export function mealDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const local = new Date(y, m - 1, d, 12);
  return dayLabel(local.toISOString());
}

export const MEAL_TYPE_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

function fmtQty(q: number): string {
  const whole = Math.floor(q);
  const frac = Math.round((q - whole) * 100) / 100;
  const f = frac === 0.5 ? "½" : frac === 0.25 ? "¼" : frac === 0.75 ? "¾" : frac ? String(Math.round(frac * 10) / 10).slice(1) : "";
  if (!whole && f) return f.startsWith(".") ? `0${f}` : f;
  return `${whole}${f}`;
}

const GENERIC_UNITS = new Set(["serving", "servings", "piece", "pieces", "pc", "pcs", "nos", "no", "item", "unit", ""]);

/** "2 × Paratha" or "Dal Tadka (1 katori)" — mirrors lib/coach itemLabel for the browser. */
export function itemLabel(i: Pick<MealItem, "name" | "quantity" | "unit">): string {
  const unit = (i.unit || "").trim();
  if (GENERIC_UNITS.has(unit.toLowerCase()) || unit.toLowerCase() === i.name.toLowerCase()) return `${fmtQty(i.quantity)} × ${i.name}`;
  return `${i.name} (${fmtQty(i.quantity)} ${unit})`;
}
