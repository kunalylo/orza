import { aiEnabled } from "@/lib/ai";
import { requireAdmin } from "@/lib/auth";
import { col, usingMongo } from "@/lib/db";
import { dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { json, route } from "@/lib/http";
import type { CreditTransaction, User } from "@/lib/types";
import { CREDIT_REQUEST_TYPE, creditRequests } from "../../credits/requests";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 5000;

/** Members only: admin (staff) accounts are never counted in member numbers. */
const MEMBERS = { is_admin: { $ne: true } } as const;

/** Ids of the admin accounts (a handful), so their own activity can be left out of platform totals. */
async function adminIds(): Promise<string[]> {
  const admins = await col<User>("users").find({ is_admin: true }, { limit: 500 });
  return admins.map((u) => u.id);
}

/** Documents matching `filter` in `name`, minus those belonging to admin accounts. */
async function countMembers(name: "meals" | "scans" | "chat_messages", filter: Record<string, unknown>, staff: string[]) {
  const c = col<{ id: string }>(name);
  const [all, ofStaff] = await Promise.all([
    c.countDocuments(filter),
    staff.length ? c.countDocuments({ ...filter, user_id: { $in: staff } }) : Promise.resolve(0),
  ]);
  return Math.max(0, all - ofStaff);
}

/** Total credits members spent: the sum of every negative transaction (paged to bound memory). */
async function creditsSpent(staff: Set<string>): Promise<number> {
  const txs = col<CreditTransaction>("credit_transactions");
  let total = 0;
  for (let skip = 0; ; skip += PAGE) {
    const page = await txs.find({ amount: { $lt: 0 } }, { sort: { created_at: 1 }, skip, limit: PAGE });
    for (const t of page) if (!staff.has(t.user_id)) total += -Number(t.amount || 0);
    if (page.length < PAGE) break;
  }
  return total;
}

/**
 * GET /api/admin/stats (admin only) →
 * {users, new_users_7d, meals_today, meals_total, scans_total, chat_messages_total, credits_spent_total, open_requests, ai_enabled, database}
 * Members only — admin (staff) accounts and their activity are excluded. `meals_today` counts meals dated
 * today in India time. `open_requests` (additive) is the number of open credit requests.
 */
export const GET = route(async () => {
  await requireAdmin();
  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const today = dateInTz(DEFAULT_TZ);
  const staff = await adminIds();

  const [users, new_users_7d, meals_today, meals_total, scans_total, chat_messages_total, credits_spent_total, open_requests] =
    await Promise.all([
      col("users").countDocuments(MEMBERS),
      col("users").countDocuments({ ...MEMBERS, created_at: { $gte: weekAgo } }),
      countMembers("meals", { date: today }, staff),
      countMembers("meals", {}, staff),
      countMembers("scans", {}, staff),
      countMembers("chat_messages", {}, staff),
      creditsSpent(new Set(staff)),
      creditRequests().countDocuments({ type: CREDIT_REQUEST_TYPE, status: "open" }),
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
      open_requests,
      ai_enabled: aiEnabled(),
      database: usingMongo() ? "mongodb" : "local-file",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
