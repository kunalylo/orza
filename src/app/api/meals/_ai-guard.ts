/**
 * Spend guards for the paid AI meal routes (not a route itself).
 *
 * withCredits() refunds whenever its callback throws, which is right for AI outages but would let a
 * completed — and paid-for — AI call that simply found no food be retried for free forever. So:
 *  - AI failures (timeouts, 5xx) are still always refunded by withCredits;
 *  - a completed call that finds nothing is refunded only for the first few per day
 *    ({@link FREE_EMPTY_RESULTS_PER_DAY}); after that the credits stay spent;
 *  - each user gets a per-minute request budget and a small number of concurrent calls per action.
 *
 * Counts come from `credit_transactions` (every spend and refund is recorded there), so the limits
 * hold across server instances; the in-flight cap is per instance and only smooths bursts.
 */
import { CREDIT_COSTS, refundCredits, type CreditAction } from "@/lib/credits";
import { col } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CreditTransaction } from "@/lib/types";

type MealAiAction = Extract<CreditAction, "scan" | "meal_text">;

interface Policy {
  /** Reason recorded on the spend transaction (must match what the route passes to withCredits). */
  reason: string;
  perMinute: number;
  concurrent: number;
}

export const MEAL_AI: Record<MealAiAction, Policy> = {
  scan: { reason: "Snap & Know scan", perMinute: 6, concurrent: 1 },
  meal_text: { reason: "Meal log (text)", perMinute: 12, concurrent: 2 },
};

/** Completed AI calls that found nothing and are still refunded, per action, per rolling 24 hours. */
export const FREE_EMPTY_RESULTS_PER_DAY = 3;

const emptyReason = (action: MealAiAction) => `${MEAL_AI[action].reason} — nothing found`;
const since = (ms: number) => new Date(Date.now() - ms).toISOString();

const inFlight = new Map<string, number>();

/**
 * Reserve an AI call for this user. Returns a `release` function to call in `finally`, or `null`
 * when the user is over the per-minute or concurrency limit (the caller decides whether to fall
 * back to a free path or answer 429 — see {@link rateLimited}).
 */
export async function reserveMealAi(userId: string, action: MealAiAction): Promise<(() => void) | null> {
  const policy = MEAL_AI[action];
  const key = `${action}:${userId}`;
  const running = inFlight.get(key) ?? 0;
  if (running >= policy.concurrent) return null;
  inFlight.set(key, running + 1); // reserve before awaiting so parallel requests see it
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const n = (inFlight.get(key) ?? 1) - 1;
    if (n > 0) inFlight.set(key, n);
    else inFlight.delete(key);
  };
  try {
    const recent = await col<CreditTransaction>("credit_transactions").countDocuments({
      user_id: userId,
      reason: policy.reason,
      amount: { $lt: 0 },
      created_at: { $gte: since(60_000) },
    });
    if (recent >= policy.perMinute) {
      release();
      return null;
    }
    return release;
  } catch (e) {
    release();
    throw e;
  }
}

/** 429 for a photo scan that can't be reserved. */
export function rateLimited(): HttpError {
  return new HttpError(429, "You're scanning faster than ÖRZA can keep up — please wait a minute and try again.", "rate_limited");
}

/**
 * A completed AI call found nothing to log. Refunds its credits if the user still has free empty
 * results left today and returns whether it did; otherwise the credits stay spent.
 */
export async function refundEmptyResult(userId: string, action: MealAiAction): Promise<boolean> {
  const refunds = await col<CreditTransaction>("credit_transactions").countDocuments({
    user_id: userId,
    reason: `Refund: ${emptyReason(action)}`,
    created_at: { $gte: since(24 * 60 * 60_000) },
  });
  if (refunds >= FREE_EMPTY_RESULTS_PER_DAY) return false;
  await refundCredits(userId, action, emptyReason(action));
  return true;
}

/** "No credits were used." / "This used 2 credits, …" — the sentence to add to an empty-result message. */
export function emptyResultCreditNote(action: MealAiAction, refunded: boolean): string {
  if (refunded) return "No credits were used.";
  const cost = CREDIT_COSTS[action];
  return `This used ${cost} credit${cost === 1 ? "" : "s"}, as ÖRZA's AI still did the work (only the first ${FREE_EMPTY_RESULTS_PER_DAY} a day are refunded).`;
}
