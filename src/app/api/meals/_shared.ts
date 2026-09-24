/** Shared validation + helpers for the /api/meals/* routes (not a route itself). */
import { z } from "zod";
import { col } from "@/lib/db";
import { addDays, dateInTz, DEFAULT_TZ, isISODate } from "@/lib/dates";
import { badRequest } from "@/lib/http";
import type { MealType, User } from "@/lib/types";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const satisfies readonly MealType[];
export const mealTypeSchema = z.enum(MEAL_TYPES, {
  errorMap: () => ({ message: "meal_type must be breakfast, lunch, dinner or snack" }),
});

const amount = (label: string, max: number) =>
  z
    .number({ invalid_type_error: `${label} must be a number` })
    .finite()
    .min(0, `${label} can't be negative`)
    .max(max, `${label} looks too high`);

/** A meal item as sent by clients (manual entry, edits, scan confirmation). */
export const itemSchema = z.object({
  name: z.string().trim().min(1, "Every item needs a name").max(80),
  quantity: z.number({ invalid_type_error: "Quantity must be a number" }).finite().positive("Quantity must be more than 0").max(100),
  unit: z.string().trim().max(24).optional(),
  grams: amount("Grams", 5000).optional(),
  calories: amount("Calories", 5000),
  protein_g: amount("Protein", 500).optional(),
  carbs_g: amount("Carbs", 1000).optional(),
  fat_g: amount("Fat", 500).optional(),
  fiber_g: amount("Fibre", 200).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const itemsSchema = z.array(itemSchema).min(1, "Add at least one item").max(20, "A meal can have up to 20 items");

/** Optional "YYYY-MM-DD" from a body or query string. */
export const optionalDate = z.string().max(10).nullish();

export const userTz = (user: User) => user.profile?.timezone || DEFAULT_TZ;

/**
 * The calendar day to act on: the user's "today" when absent, otherwise a validated
 * real date that isn't in the future (one day of slack for timezone edges).
 */
export function resolveDate(user: User, date?: string | null): string {
  const today = dateInTz(userTz(user));
  if (date == null || date === "") return today;
  const parsed = isISODate(date) ? new Date(`${date}T00:00:00Z`) : null;
  const real = !!parsed && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  if (!real) throw badRequest("date must be a valid YYYY-MM-DD day");
  if (date > addDays(today, 1)) throw badRequest("You can't log meals for a future day");
  if (date < "2000-01-01") throw badRequest("That date is too far in the past");
  return date;
}

/** Fresh credit balance after a credit-spending call. */
export async function currentCredits(userId: string): Promise<number | undefined> {
  return (await col<User>("users").findOne({ id: userId }))?.credits;
}
