/**
 * Client-safe helpers + API response types for the meal log and Snap & Know screens.
 * (Server modules like `@/lib/domain/meals` pull in the database, so the few pure bits
 * we need on the client are mirrored here.)
 */
import { Camera, Cookie, Keyboard, ListPlus, MessageCircle, Mic, MoonStar, Sun, Sunrise, type LucideIcon } from "lucide-react";
import type { Meal, MealItem, MealSource, MealType, Nutrients, Scan } from "@/lib/types";
import { hourInTz, isISODate } from "@/lib/dates";
import { round } from "@/lib/utils";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };
export const MEAL_SINGULAR: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
export const MEAL_ICON: Record<MealType, LucideIcon> = { breakfast: Sunrise, lunch: Sun, dinner: MoonStar, snack: Cookie };

export const SOURCE_LABEL: Record<MealSource, string> = { photo: "Photo", text: "Typed", voice: "Voice", manual: "Food list", chat: "Chat" };
export const SOURCE_ICON: Record<MealSource, LucideIcon> = { photo: Camera, text: Keyboard, voice: Mic, manual: ListPlus, chat: MessageCircle };

/** Used only when /api/credits/balance can't be reached (mirrors CREDIT_COSTS). */
export const FALLBACK_COSTS = { scan: 2, meal_text: 1 } as const;

export const ZERO_NUTRIENTS: Nutrients = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

/* ───────────────────────── API shapes ───────────────────────── */

export type MealsResponse = { date?: string; meals: Meal[]; totals: Nutrients };
export type TextLogResponse = { meal: Meal; ai: boolean; unmatched: string[]; credits?: number; notice?: string };
export type ScanResponse = { scan: Scan; credits: number };
export type FoodDietMark = "veg" | "vegan" | "egg" | "nonveg";
export type FoodHit = {
  key: string;
  name: string;
  serving: { unit: string; grams: number; label: string };
  per_serving: Nutrients;
  diet: FoodDietMark;
  category: string;
  restaurant_multiplier?: number;
};

/* ───────────────────────── Helpers ───────────────────────── */

/** A real calendar day in YYYY-MM-DD form (rejects e.g. 2025-02-31). */
export function isRealDay(s: string | null | undefined): s is string {
  if (!isISODate(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const isMealType = (s: string | null | undefined): s is MealType => !!s && (MEAL_TYPES as string[]).includes(s);

/** Same windows as the server's guessMealType. */
export function guessMealTypeClient(tz?: string): MealType {
  const h = hourInTz(tz);
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 19 || h < 2) return "dinner";
  return "snack";
}

export function sumNutrientsClient(list: Partial<Nutrients>[]): Nutrients {
  const t = list.reduce<Nutrients>(
    (a, n) => ({
      calories: a.calories + (Number(n.calories) || 0),
      protein_g: a.protein_g + (Number(n.protein_g) || 0),
      carbs_g: a.carbs_g + (Number(n.carbs_g) || 0),
      fat_g: a.fat_g + (Number(n.fat_g) || 0),
      fiber_g: a.fiber_g + (Number(n.fiber_g) || 0),
    }),
    { ...ZERO_NUTRIENTS }
  );
  return {
    calories: Math.round(t.calories),
    protein_g: round(t.protein_g, 1),
    carbs_g: round(t.carbs_g, 1),
    fat_g: round(t.fat_g, 1),
    fiber_g: round(t.fiber_g, 1),
  };
}

const FRACTIONS: Record<string, string> = { "0.25": "¼", "0.5": "½", "0.75": "¾" };

/** 0.5 → "½", 1.5 → "1½", 2 → "2", 1.33 → "1.33". */
export function fmtQty(q: number): string {
  const n = round(Number(q) || 0, 2);
  const whole = Math.floor(n);
  const frac = round(n - whole, 2);
  const sym = FRACTIONS[String(frac)];
  if (sym) return whole ? `${whole}${sym}` : sym;
  return String(n);
}

export function itemPortion(i: Pick<MealItem, "quantity" | "unit" | "grams">): string {
  const base = `${fmtQty(i.quantity)} ${i.unit}`;
  return i.grams && i.unit.toLowerCase() !== "g" ? `${base} · ${Math.round(i.grams)} g` : base;
}

/** "Today", "Yesterday", or e.g. "Mon, 21 Sep". */
export function formatDayLabel(date: string, today: string, yesterday: string): string {
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  const [y, m, d] = date.split("-").map(Number);
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
  if (y !== Number(today.slice(0, 4))) opts.year = "numeric";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", opts);
}

export function formatTime(iso: string, tz?: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
  } catch {
    return "";
  }
}

export function confidenceTone(c: number): { tone: "success" | "info" | "warning"; label: string } {
  if (c >= 0.8) return { tone: "success", label: "High confidence" };
  if (c >= 0.55) return { tone: "info", label: "Medium confidence" };
  return { tone: "warning", label: "Low confidence — please check" };
}
