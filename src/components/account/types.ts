/** Response shapes of the account API routes (credits, settings, admin), shared by the client screens. */
import type { CreditAction } from "@/lib/credits";
import type { CreditTransaction, PublicUser } from "@/lib/types";

export type CreditCosts = Record<CreditAction, number>;

export type BalanceResponse = {
  credits: number;
  costs: CreditCosts;
  ai_enabled: boolean;
  /** Net credits used in the last 30 days (additive field). */
  spent_30d?: number;
};

export type TransactionsResponse = { transactions: CreditTransaction[] };

export type UserResponse = { user: PublicUser };

export type ProfileResponse = UserResponse & { targets_recomputed?: boolean };

export type AdminStats = {
  users: number;
  new_users_7d: number;
  meals_today: number;
  meals_total: number;
  scans_total: number;
  chat_messages_total: number;
  credits_spent_total: number;
  ai_enabled: boolean;
  database: "mongodb" | "local-file";
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  credits: number;
  onboarding_complete: boolean;
  created_at: string;
  is_admin: boolean;
};

export type AdminUsersResponse = { users: AdminUserRow[]; total?: number };

export type AdjustResponse = { balance: number; transaction: CreditTransaction };
