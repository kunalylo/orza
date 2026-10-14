"use client";
import { useUser } from "@/components/app/UserProvider";
import { TeamManager } from "@/components/admin/TeamManager";
import { SuperAdminOnly } from "@/components/admin/ui";

/** Admin console — Team (super admin only): add, reset and remove sub-admins. */
export default function AdminTeamPage() {
  const { user } = useUser();
  if (user.admin_role !== "super") return <SuperAdminOnly title="Team" />;
  return <TeamManager currentUserId={user.id} />;
}
