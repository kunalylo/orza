import { isAdmin, isSuperAdmin, requireSuperAdmin, revokeAllSessions } from "@/lib/auth";
import { col } from "@/lib/db";
import { forbidden, json, notFound, route } from "@/lib/http";
import type { User } from "@/lib/types";
import { adminIdParam } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/team/[id] (super admin only) → {ok:true}
 * Removes a sub-admin's staff account: signs it out everywhere and deletes the user record. Super
 * admins can't be removed from the panel, and nobody can remove their own account here.
 */
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const owner = await requireSuperAdmin();
  const id = adminIdParam((await ctx.params).id);
  if (id === owner.id) throw forbidden("You can't remove your own admin account.");

  const users = col<User>("users");
  const target = await users.findOne({ id });
  if (!target || !isAdmin(target)) throw notFound("Admin not found");
  if (isSuperAdmin(target)) throw forbidden("A super admin can't be removed from the panel.");

  // Sessions first, so the account stops working even if the delete below has to be retried.
  // The filter repeats the role so a concurrent promotion to super is never removed.
  const sessions = await revokeAllSessions(target.id);
  const removed = await users.deleteOne({ id: target.id, is_admin: true, admin_role: { $ne: "super" } });
  if (!removed) throw notFound("Admin not found");

  console.info("[orza] admin removed", { by: owner.id, admin_id: target.id, sessions_revoked: sessions });
  return json({ ok: true });
});
