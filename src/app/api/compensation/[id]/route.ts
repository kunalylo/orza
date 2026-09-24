import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, notFound, route } from "@/lib/http";
import type { CompensationPlan } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Delete one of the user's rebalance plans. */
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!id || id.length > 100) throw notFound("Plan not found");
  const n = await col<CompensationPlan>("compensation_plans").deleteOne({ id, user_id: user.id });
  if (!n) throw notFound("Plan not found");
  return json({ ok: true });
});
