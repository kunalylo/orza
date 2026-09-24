import { aiEnabled } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth";
import { col, usingMongo } from "@/lib/db";
import { dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { json, route } from "@/lib/http";
import type { CreditTransaction } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 5000;

/** Total credits spent across all users: the sum of every negative transaction (paged to bound memory). */
async function creditsSpent(): Promise<number> {
  const txs = col<CreditTransaction>("credit_transactions");
  let total = 0;
  for (let skip = 0; ; skip += PAGE) {
    const page = await txs.find({ amount: { $lt: 0 } }, { sort: { created_at: 1 }, skip, limit: PAGE });
    for (const t of page) total += -Number(t.amount || 0);
    if (page.length < PAGE) break;
  }
  return total;
}

/**
 * GET /api/admin/stats (admin only) →
 * {users, new_users_7d, meals_today, meals_total, scans_total, chat_messages_total, credits_spent_total, ai_enabled, database}
 * `meals_today` counts meals dated today in India time (any user).
 */
export const GET = route(async () => {
  await requireAdmin();
  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const today = dateInTz(DEFAULT_TZ);

  const [users, new_users_7d, meals_today, meals_total, scans_total, chat_messages_total, credits_spent_total] = await Promise.all([
    col("users").countDocuments({}),
    col("users").countDocuments({ created_at: { $gte: weekAgo } }),
    col("meals").countDocuments({ date: today }),
    col("meals").countDocuments({}),
    col("scans").countDocuments({}),
    col("chat_messages").countDocuments({}),
    creditsSpent(),
  ]);

  return json(
    {
      users,
      new_users_7d,
      meals_today,
      meals_total,
      scans_total,
      chat_messages_total,
      credits_spent_total,
      ai_enabled: aiEnabled(),
      database: usingMongo() ? "mongodb" : "local-file",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
