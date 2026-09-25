/**
 * "Request more credits" storage (server only).
 *
 * Requests are sent from inside the signed-in account (POST /api/credits/request) and kept in the
 * `leads` collection — where the team already looks for inbound messages — as one document per
 * request, tied to the account by `user_id`. The email, name and balance are read on the server,
 * never taken from the client. Each request gets its own `source` (`credits-request:<id>`), so the
 * (email, source) unique index on `leads` never merges or overwrites two requests.
 *
 * Before sign-in was required, requests were stored as public leads keyed by email with the plain
 * source "credits-request" (`LEGACY_CREDIT_REQUEST_SOURCE`); /api/leads no longer accepts it.
 */
import { col } from "@/lib/db";

export const CREDIT_REQUEST_TYPE = "credit_request" as const;
export const CREDIT_REQUEST_SOURCE_PREFIX = "credits-request";
export const LEGACY_CREDIT_REQUEST_SOURCE = "credits-request";

/** Requests a member may send in a rolling 24 hours (the team replies by email, so more is noise). */
export const CREDIT_REQUESTS_PER_DAY = 3;

export type CreditRequestStatus = "open" | "done";

export interface CreditRequestDoc {
  id: string;
  type: typeof CREDIT_REQUEST_TYPE;
  /** `credits-request:<id>` — unique per request (see the note above). */
  source: string;
  user_id: string;
  email: string;
  name: string;
  message: string;
  /** Balance read from the account when the request was sent. */
  balance: number;
  status: CreditRequestStatus;
  created_at: string;
  updated_at: string;
  handled_at?: string;
  handled_by?: string;
}

export const creditRequests = () => col<CreditRequestDoc>("leads");

/** What the member (and the data export) sees about one of their requests. */
export function toOwnView(r: CreditRequestDoc) {
  return {
    id: r.id,
    message: r.message,
    balance: r.balance,
    status: r.status,
    created_at: r.created_at,
    handled_at: r.handled_at ?? null,
  };
}

/** Marks every open request of a member as handled (after an admin grants credits, or by hand). */
export async function closeOpenRequests(userId: string, adminId: string, at: string): Promise<number> {
  const open = await creditRequests().find({ type: CREDIT_REQUEST_TYPE, user_id: userId, status: "open" }, { limit: 50 });
  for (const r of open) {
    await creditRequests().updateOne(
      { id: r.id, type: CREDIT_REQUEST_TYPE, status: "open" },
      { $set: { status: "done", handled_at: at, handled_by: adminId, updated_at: at } }
    );
  }
  return open.length;
}
