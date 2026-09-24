import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { addDays, dateInTz } from "@/lib/dates";
import { trackingInRange } from "@/lib/domain/tracking";
import { json, route } from "@/lib/http";
import type { Goal } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Active goal + last 120 days of weigh-ins (ascending) + current targets/profile. */
export const GET = route(async () => {
  const user = await requireUser();
  const today = dateInTz(user.profile?.timezone);

  const [active] = await col<Goal>("goals").find({ user_id: user.id, active: true }, { sort: { created_at: -1 }, limit: 1 });
  const days = await trackingInRange(user.id, addDays(today, -119), today);
  const weights = days
    .filter((d) => typeof d.weight_kg === "number" && d.weight_kg > 0)
    .map((d) => ({ date: d.date, weight_kg: d.weight_kg as number }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return json({
    goal: active || null,
    weights,
    targets: user.targets,
    profile: user.profile || {},
    today,
  });
});
