/** Response shapes of the admin console APIs (team, stats extras). */
import type { AdminStats } from "@/components/account/types";
import type { AiReportKind, AiReportReason } from "@/lib/ai-report-shared";
import type { AdminRole } from "@/lib/types";

/** GET /api/admin/stats — members only; `open_requests` counts open credit requests, `open_ai_reports` AI reports to review. */
export type ConsoleStats = AdminStats & { open_requests?: number; open_ai_reports?: number };

/** A member's report of AI output, as GET /api/admin/ai-reports lists it (src/lib/ai-reports.ts `toAdminRow`). */
export type AdminAiReport = {
  id: string;
  kind: AiReportKind;
  ref_id: string;
  reason: AiReportReason;
  note: string | null;
  /** What the member was shown, as plain text. */
  text: string;
  /** False: the built-in coach, a curated recipe, the built-in plan or the food list wrote it. */
  ai: boolean;
  client: "app" | "web";
  made_at: string;
  created_at: string;
  updated_at: string;
  reviewed: boolean;
  reviewed_at: string | null;
  /** Null when the account no longer exists. */
  member: { id: string; name: string; email: string } | null;
};

export type AiReportsStatus = "open" | "reviewed" | "all";

export type AdminAiReportsResponse = { reports: AdminAiReport[]; open: number };

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
