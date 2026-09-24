import { addDays, isISODate } from "@/lib/dates";

/** How far back the streak looks (the streak therefore tops out at LOOKBACK + 1). */
export const STREAK_LOOKBACK_DAYS = 60;

/**
 * Consecutive days with ≥1 meal logged, ending today — or yesterday, so a
 * streak isn't "lost" in the morning before the first meal is logged.
 */
export function computeStreak(mealDates: Set<string>, today: string): number {
  let cursor = mealDates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (mealDates.has(cursor) && n <= STREAK_LOOKBACK_DAYS) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** A real calendar day in YYYY-MM-DD form (isISODate only checks the shape, so "2026-02-31" would pass). */
export function isRealDay(s: unknown): s is string {
  if (!isISODate(s)) return false;
  try {
    return addDays(s, 0) === s;
  } catch {
    return false;
  }
}
