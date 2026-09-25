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

/** One of the member's own "Request more credits" messages. */
export type CreditRequestView = {
  id: string;
  message: string;
  balance: number;
  status: "open" | "done";
  created_at: string;
  handled_at: string | null;
};

export type CreditRequestResponse = { request: CreditRequestView };

export type CreditRequestsResponse = { requests: CreditRequestView[]; pending: CreditRequestView | null };

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

export type AdjustResponse = { balance: number; transaction: CreditTransaction; requests_closed?: number };

/** An open credit request as the admin panel lists it (member details read server-side). */
export type AdminCreditRequest = {
  id: string;
  message: string;
  /** Balance when the request was sent. */
  balance: number;
  created_at: string;
  /** The member now (current balance etc.); null when the account no longer exists. */
  user: AdminUserRow | null;
  /** Name and email recorded with the request (shown if the account is gone). */
  name: string;
  email: string;
};

export type AdminCreditRequestsResponse = { requests: AdminCreditRequest[] };
