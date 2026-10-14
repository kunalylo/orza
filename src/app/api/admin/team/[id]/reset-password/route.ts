import { hashPassword, isAdmin, isSuperAdmin, requireSuperAdmin, revokeAllSessions } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { forbidden, json, notFound, route } from "@/lib/http";
import type { User } from "@/lib/types";
import { adminIdParam, generatePassword, toAdminRow } from "../../_lib";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/team/[id]/reset-password (super admin only) → {admin, password}
 * Gives a sub-admin a new generated password (returned this once) and signs them out everywhere.
 * Your own password is changed from My account; super admins' passwords can't be reset from the panel.
 */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const owner = await requireSuperAdmin();
  const id = adminIdParam((await ctx.params).id);
  if (id === owner.id) throw forbidden("Change your own password from My account.");

  const users = col<User>("users");
  const target = await users.findOne({ id });
  if (!target || !isAdmin(target)) throw notFound("Admin not found");
  if (isSuperAdmin(target)) throw forbidden("A super admin's password can't be reset from the panel.");

  const password = generatePassword();
  const { matched } = await users.updateOne(
    { id: target.id, is_admin: true, admin_role: { $ne: "super" } },
    { $set: { password_hash: await hashPassword(password), updated_at: nowISO() } }
  );
  if (!matched) throw notFound("Admin not found");
  // The old password may be known to someone else: end every session it opened.
  const sessions = await revokeAllSessions(target.id);

  console.info("[orza] admin password reset", { by: owner.id, admin_id: target.id, sessions_revoked: sessions });
  return json({ admin: toAdminRow(target), password });
});
