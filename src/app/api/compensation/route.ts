import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { CREDIT_COSTS } from "@/lib/credits";
import { col } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { StoredCompensationPlan } from "@/lib/compensation";

export const dynamic = "force-dynamic";

/** The user's rebalance plans, newest first (max 20). */
export const GET = route(async () => {
  const user = await requireUser();
  const plans = await col<StoredCompensationPlan>("compensation_plans").find({ user_id: user.id }, { sort: { created_at: -1 }, limit: 20 });
  return json({ plans, ai_enabled: aiEnabled(), cost: CREDIT_COSTS.compensation });
});
