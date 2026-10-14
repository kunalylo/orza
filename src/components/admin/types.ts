/** Response shapes of the admin console APIs (team, stats extras). */
import type { AdminStats } from "@/components/account/types";
import type { AdminRole } from "@/lib/types";

/** GET /api/admin/stats — members only; `open_requests` counts open credit requests. */
export type ConsoleStats = AdminStats & { open_requests?: number };

export type TeamAdmin = {
  id: string;
  name: string;
  email: string;
  admin_role: AdminRole;
  created_at: string;
  last_sign_in?: string;
};

export type TeamResponse = { admins: TeamAdmin[] };

export type CreateAdminResponse = { admin: TeamAdmin; password: string; generated: boolean };

export type ResetPasswordResponse = { admin: TeamAdmin; password: string };
