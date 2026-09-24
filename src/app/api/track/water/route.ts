import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getTrackingDay, setTracking } from "@/lib/domain/tracking";
import { json, parseBody, route } from "@/lib/http";
import { boundedNumber, optionalDay, resolveTrackDate } from "../_shared";

export const dynamic = "force-dynamic";

const Body = z.object({
  glasses: boundedNumber(0, 40),
  date: optionalDay,
});

/** POST /api/track/water { glasses, date? } → { tracking } — sets the day's total glasses (not a delta). */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const date = resolveTrackDate(user, body.date);
  const tracking = (await setTracking(user.id, date, { water_glasses: body.glasses })) || (await getTrackingDay(user.id, date));
  return json({ tracking });
});
