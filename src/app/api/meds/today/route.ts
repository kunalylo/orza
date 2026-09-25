import { requireUser } from "@/lib/auth";
import { dateInTz } from "@/lib/dates";
import { badRequest, json, route } from "@/lib/http";
import { dosesForLocalDay, tzOf } from "@/lib/care/meds";
import { doseToClient, isRealDate } from "../_shared";

/**
 * GET /api/meds/today?date= → { date, now, doses }
 * Every scheduled dose of the user's active (non-SOS) medicines on that local day, with its status:
 * "upcoming" | "due" | "taken" | "skipped" | "snoozed" | "missed" (unacted 60 min after its time).
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams.get("date");
  if (q && !isRealDate(q)) throw badRequest("Use a date like 2026-09-24");
  const date = q || dateInTz(tzOf(user));
  const now = new Date();
  const doses = await dosesForLocalDay(user, date, now);
  return json({ date, now: now.toISOString(), doses: doses.map(doseToClient) });
});
