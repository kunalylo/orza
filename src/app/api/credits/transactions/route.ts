import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { CreditTransaction } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/credits/transactions → {transactions} (newest first, last 100). */
export const GET = route(async () => {
  const user = await requireUser();
  const transactions = await col<CreditTransaction>("credit_transactions").find(
    { user_id: user.id },
    { sort: { created_at: -1 }, limit: 100 }
  );
  return json({ transactions }, { headers: { "Cache-Control": "no-store" } });
});
