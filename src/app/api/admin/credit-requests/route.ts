import { isAdmin, requireAdmin } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { User } from "@/lib/types";
import { CREDIT_REQUEST_TYPE, creditRequests } from "../../credits/requests";

export const dynamic = "force-dynamic";

const MAX_OPEN = 100;

/**
 * GET /api/admin/credit-requests (admin only) → {requests}
 * Open "Request more credits" messages, oldest first (so the longest-waiting member is served first),
 * each with the member's current account row. Only requests sent from a signed-in account are listed.
 */
export const GET = route(async () => {
  await requireAdmin();
  const open = await creditRequests().find(
    { type: CREDIT_REQUEST_TYPE, status: "open" },
    { sort: { created_at: 1 }, limit: MAX_OPEN }
  );
  const ids = [...new Set(open.map((r) => r.user_id))];
  const members = ids.length ? await col<User>("users").find({ id: { $in: ids } }) : [];
  const byId = new Map(members.map((u) => [u.id, u]));

  const requests = open.map((r) => {
    const u = byId.get(r.user_id);
    return {
      id: r.id,
      message: r.message,
      balance: r.balance,
      created_at: r.created_at,
      name: r.name,
      email: r.email,
      // Explicit allow-list — never spread the stored user document (it holds the password hash).
      user: u
        ? {
            id: u.id,
            name: u.name,
            email: u.email,
            credits: u.credits ?? 0,
            onboarding_complete: !!u.onboarding_complete,
            created_at: u.created_at,
            is_admin: isAdmin(u),
          }
        : null,
    };
  });

  return json({ requests }, { headers: { "Cache-Control": "no-store" } });
});
