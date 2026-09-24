import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { addDays, dateInTz, DEFAULT_TZ, hourInTz } from "@/lib/dates";
import { listMeals, listMealsInRange, sumNutrients } from "@/lib/domain/meals";
import { getTrackingDay } from "@/lib/domain/tracking";
import { DEFAULT_TARGETS } from "@/lib/domain/targets";
import { badRequest, json, route } from "@/lib/http";
import type { Goal, Meal, Targets, TrackingDay } from "@/lib/types";
import { round } from "@/lib/utils";
import { buildInsight } from "../_lib/insight";
import { computeStreak, isRealDay, STREAK_LOOKBACK_DAYS } from "../_lib/streak";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/today?date=YYYY-MM-DD
 * → { date, today, targets, totals, meals, tracking, remaining, streak, insight, goal, week, last_weight }
 * (`today`, `week` and `last_weight` are additive helpers for the Today screen.)
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const today = dateInTz(tz);

  const q = new URL(req.url).searchParams.get("date");
  let date = today;
  if (q) {
    if (!isRealDay(q)) throw badRequest("date must be a valid day in YYYY-MM-DD format");
    // A future day has nothing to show yet — fall back to today.
    date = q > today ? today : q;
  }

  const targets: Targets = { ...DEFAULT_TARGETS, ...(user.targets || {}) };

  // Week strip: the last 7 days while browsing recent days, otherwise a window around the chosen day.
  const weekEnd = date >= addDays(today, -6) ? today : minDay(addDays(date, 3), today);
  const weekStart = addDays(weekEnd, -6);
  const streakFrom = addDays(today, -STREAK_LOOKBACK_DAYS);

  const [meals, recent, olderWeek, tracking, goal, lastWeight] = await Promise.all([
    listMeals(user.id, date),
    listMealsInRange(user.id, streakFrom, today),
    weekStart < streakFrom ? listMealsInRange(user.id, weekStart, weekEnd) : Promise.resolve<Meal[]>([]),
    getTrackingDay(user.id, date),
    col<Goal>("goals").find({ user_id: user.id, active: true }, { sort: { created_at: -1 }, limit: 1 }),
    col<TrackingDay>("tracking").find(
      { user_id: user.id, date: { $lte: date }, weight_kg: { $exists: true } },
      { sort: { date: -1 }, limit: 1 }
    ),
  ]);

  const totals = sumNutrients(meals.map((m) => m.totals));

  const streak = computeStreak(new Set(recent.map((m) => m.date)), today);

  const byDay = new Map<string, { calories: number; meals: number }>();
  for (const m of weekStart < streakFrom ? olderWeek : recent) {
    if (m.date < weekStart || m.date > weekEnd) continue;
    const e = byDay.get(m.date) || { calories: 0, meals: 0 };
    e.calories += Number(m.totals?.calories) || 0;
    e.meals += 1;
    byDay.set(m.date, e);
  }
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const e = byDay.get(d);
    return { date: d, calories: Math.round(e?.calories || 0), meals: e?.meals || 0 };
  });

  const insight = buildInsight({
    isToday: date === today,
    hour: hourInTz(tz),
    mealsCount: meals.length,
    totals,
    targets,
    water: tracking.water_glasses || 0,
    diet: user.profile?.diet,
  });

  const lw = lastWeight[0];

  return json({
    date,
    today,
    targets,
    totals,
    meals,
    tracking,
    remaining: {
      calories: Math.round(targets.calories - totals.calories),
      protein_g: round(targets.protein_g - totals.protein_g, 1),
    },
    streak,
    insight,
    goal: goal[0] || null,
    week,
    last_weight: lw?.weight_kg != null ? { weight_kg: lw.weight_kg, date: lw.date } : null,
  });
});

const minDay = (a: string, b: string) => (a < b ? a : b);
