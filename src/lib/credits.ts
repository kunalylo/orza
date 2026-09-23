import { col, newId, nowISO } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CreditTransaction, User } from "@/lib/types";

export const INITIAL_CREDITS = 100;

/** AI credit cost per action. Non-AI fallbacks are free. */
export const CREDIT_COSTS = {
  scan: 2,
  meal_text: 1,
  chat: 1,
  recipe: 2,
  compensation: 1,
  report_insight: 1,
} as const;
export type CreditAction = keyof typeof CREDIT_COSTS;

async function record(userId: string, amount: number, reason: string, balance_after: number) {
  const tx: CreditTransaction = { id: newId(), user_id: userId, amount, reason, balance_after, created_at: nowISO() };
  await col<CreditTransaction>("credit_transactions").insertOne(tx);
  return tx;
}

/** Atomically spend credits. Throws 402 when the balance is too low. Returns the new balance. */
export async function spendCredits(userId: string, action: CreditAction, reason?: string): Promise<number> {
  const cost = CREDIT_COSTS[action];
  const u = await col<User>("users").findOneAndUpdate(
    { id: userId, credits: { $gte: cost } },
    { $inc: { credits: -cost } }
  );
  if (!u) {
    throw new HttpError(402, "You're out of AI credits. Top up on the Credits page to keep using AI features.", "no_credits");
  }
  await record(userId, -cost, reason || action, u.credits);
  return u.credits;
}

/** Give back credits when an AI call fails after spending. */
export async function refundCredits(userId: string, action: CreditAction, reason?: string) {
  const cost = CREDIT_COSTS[action];
  const u = await col<User>("users").findOneAndUpdate({ id: userId }, { $inc: { credits: cost } });
  if (u) await record(userId, cost, `Refund: ${reason || action}`, u.credits);
}

/** Admin/system grant (amount may be negative, floor at 0). */
export async function adjustCredits(userId: string, amount: number, reason: string) {
  const users = col<User>("users");
  const cur = await users.findOne({ id: userId });
  if (!cur) throw new HttpError(404, "User not found", "not_found");
  const delta = Math.max(-cur.credits, Math.round(amount));
  const u = await users.findOneAndUpdate({ id: userId }, { $inc: { credits: delta } });
  const tx = await record(userId, delta, reason, u?.credits ?? cur.credits + delta);
  return { balance: u?.credits ?? cur.credits + delta, transaction: tx };
}

/** Runs `fn` after spending credits; refunds if `fn` throws. */
export async function withCredits<T>(userId: string, action: CreditAction, fn: () => Promise<T>, reason?: string): Promise<T> {
  await spendCredits(userId, action, reason);
  try {
    return await fn();
  } catch (e) {
    await refundCredits(userId, action, reason).catch(() => {});
    throw e;
  }
}
