import { aiEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { CREDIT_COSTS } from "@/lib/credits";
import { col } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { CreditTransaction } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/credits/balance → {credits, costs, ai_enabled, spent_30d}
 * `spent_30d` (additive) is the net number of credits used in the last 30 days (spends minus refunds).
 */
export const GET = route(async () => {
  const user = await requireUser();
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const recent = await col<CreditTransaction>("credit_transactions").find(
    { user_id: user.id, created_at: { $gte: since } },
    { sort: { created_at: -1 }, limit: 5000 }
  );
  // Spends are negative; refunds ("Refund: …") give them back. Admin grants are not usage.
  const spent = recent.reduce((sum, t) => {
    if (t.amount < 0) return sum - t.amount;
    if (/^refund:/i.test(t.reason || "")) return sum - t.amount;
    return sum;
  }, 0);

  return json(
    { credits: Math.max(0, user.credits ?? 0), costs: CREDIT_COSTS, ai_enabled: aiEnabled(), spent_30d: Math.max(0, spent) },
    { headers: { "Cache-Control": "no-store" } }
  );
});
