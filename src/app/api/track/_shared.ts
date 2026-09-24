import { z } from "zod";
import { dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { badRequest } from "@/lib/http";
import type { User } from "@/lib/types";
import { isRealDay } from "@/app/api/dashboard/_lib/streak";

/** Optional `date` on tracking bodies (null/"" mean "today"). */
export const optionalDay = z.string().max(10).nullish();

/** The day a tracking write applies to: the user's today by default; never a future day. */
export function resolveTrackDate(user: User, date?: string | null): string {
  const today = dateInTz(user.profile?.timezone || DEFAULT_TZ);
  if (date == null || date === "") return today;
  if (!isRealDay(date)) throw badRequest("date must be a valid day in YYYY-MM-DD format");
  if (date > today) throw badRequest("You can't log for a day that hasn't happened yet");
  return date;
}

/**
 * A finite number within [min, max], rounded to `digits` decimals.
 * Messages read naturally after route()'s "field: " prefix, e.g. "glasses: must be between 0 and 40".
 */
export function boundedNumber(min: number, max: number, digits = 0) {
  const f = 10 ** digits;
  const range = `must be between ${min} and ${max}`;
  return z
    .number({ required_error: "is required", invalid_type_error: "must be a number" })
    .finite("must be a number")
    .min(min, range)
    .max(max, range)
    .transform((n) => Math.round(n * f) / f);
}
