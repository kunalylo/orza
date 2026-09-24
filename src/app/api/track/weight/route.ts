import { z } from "zod";
import { requireUser, toPublicUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { getTrackingDay, setTracking } from "@/lib/domain/tracking";
import { json, parseBody, route } from "@/lib/http";
import type { PublicUser, TrackingDay, User } from "@/lib/types";
import { boundedNumber, optionalDay, resolveTrackDate } from "../_shared";

export const dynamic = "force-dynamic";

const Body = z.object({
  weight_kg: boundedNumber(20, 400, 1),
  date: optionalDay,
});

/**
 * POST /api/track/weight { weight_kg, date? } → { tracking, user? }
 * Also keeps profile.weight_kg current — unless this entry is back-filled behind a newer weigh-in,
 * in which case the profile keeps the newer value. `user` (public) is included when the profile changed.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const date = resolveTrackDate(user, body.date);

  const tracking = (await setTracking(user.id, date, { weight_kg: body.weight_kg })) || (await getTrackingDay(user.id, date));

  const newer = await col<TrackingDay>("tracking").findOne({ user_id: user.id, date: { $gt: date }, weight_kg: { $exists: true } });
  let publicUser: PublicUser | undefined;
  if (!newer) {
    const updated = await col<User>("users").findOneAndUpdate(
      { id: user.id },
      { $set: { "profile.weight_kg": body.weight_kg, updated_at: nowISO() } }
    );
    if (updated) publicUser = toPublicUser(updated);
  }

  return json(publicUser ? { tracking, user: publicUser } : { tracking });
});
