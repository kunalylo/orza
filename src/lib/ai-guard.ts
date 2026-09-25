/**
 * Spend guards shared by every paid AI route (meal scan + text, prescription scan, chat, recipes,
 * rebalance plans).
 *
 * withCredits() refunds whenever its callback throws, which is right for AI outages but would let a
 * completed — and paid-for — AI call whose answer can't be used (no food found, an empty chat reply,
 * a recipe that breaks the diet) be retried for free forever. So:
 *  - AI failures (timeouts, 5xx) are still always refunded by withCredits — keep only the AI call
 *    inside its callback;
 *  - a completed call whose answer is unusable is refunded only for the first few per day
 *    ({@link FREE_EMPTY_RESULTS_PER_DAY}, per action); after that the credits stay spent;
 *  - each user gets a per-minute request budget and a small number of concurrent calls per action.
 *
 * Counts come from `credit_transactions` (every spend and refund is recorded there, with its action),
 * so the limits hold across server instances; the in-flight cap is per instance and only smooths bursts.
 */
import { CREDIT_COSTS, refundCredits, type CreditAction } from "@/lib/credits";
import { col } from "@/lib/db";
import { HttpError } from "@/lib/http";
import type { CreditTransaction } from "@/lib/types";

export type GuardedAiAction = Extract<CreditAction, "scan" | "meal_text" | "chat" | "recipe" | "compensation">;

interface Policy {
  /** Default reason recorded on the spend transaction (routes may pass a more specific one). */
  reason: string;
  /** What an unusable answer is called in its refund reason ("Refund: <reason> — <empty>"). */
  empty: string;
  perMinute: number;
  concurrent: number;
}

export const AI_GUARD: Record<GuardedAiAction, Policy> = {
  scan: { reason: "Snap & Know scan", empty: "nothing found", perMinute: 6, concurrent: 1 },
  meal_text: { reason: "Meal log (text)", empty: "nothing found", perMinute: 12, concurrent: 2 },
  chat: { reason: "Ask ÖRZA", empty: "no usable answer", perMinute: 10, concurrent: 2 },
  recipe: { reason: "Recipe", empty: "no usable recipe", perMinute: 5, concurrent: 1 },
  compensation: { reason: "Rebalance plan", empty: "no usable plan", perMinute: 5, concurrent: 1 },
};

/** Completed AI calls with an unusable answer that are still refunded, per action, per rolling 24 hours. */
export const FREE_EMPTY_RESULTS_PER_DAY = 3;

const emptyReason = (action: GuardedAiAction) => `${AI_GUARD[action].reason} — ${AI_GUARD[action].empty}`;
const since = (ms: number) => new Date(Date.now() - ms).toISOString();

const g = globalThis as typeof globalThis & { __orzaAiInFlight?: Map<string, number> };
const inFlight: Map<string, number> = (g.__orzaAiInFlight ||= new Map());

/**
 * Reserve an AI call for this user. Returns a `release` function to call in `finally`, or `null`
 * when the user is over the per-minute or concurrency limit (the caller decides whether to fall
 * back to a free path or answer 429 — see {@link aiRateLimited}).
 */
export async function reserveAi(userId: string, action: GuardedAiAction): Promise<(() => void) | null> {
  const policy = AI_GUARD[action];
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
      action,
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

/** 429 for an AI call that can't be reserved and has no free fallback (photo scans). */
export function aiRateLimited(
  message = "You're scanning faster than ÖRZA can keep up — please wait a minute and try again."
): HttpError {
  return new HttpError(429, message, "rate_limited");
}

/**
 * A completed AI call produced nothing usable. Refunds its credits if the user still has free
 * unusable results left today for this action and returns whether it did; otherwise the credits
 * stay spent.
 */
export async function refundEmptyResult(userId: string, action: GuardedAiAction): Promise<boolean> {
  const refunds = await col<CreditTransaction>("credit_transactions").countDocuments({
    user_id: userId,
    reason: `Refund: ${emptyReason(action)}`,
    created_at: { $gte: since(24 * 60 * 60_000) },
  });
  if (refunds >= FREE_EMPTY_RESULTS_PER_DAY) return false;
  await refundCredits(userId, action, emptyReason(action));
  return true;
}

/** "No credits were used." / "This used 2 credits, …" — the sentence to add to an unusable-result message. */
export function emptyResultCreditNote(action: GuardedAiAction, refunded: boolean): string {
  if (refunded) return "No credits were used.";
  const cost = CREDIT_COSTS[action];
  return `This used ${cost} credit${cost === 1 ? "" : "s"}, as ÖRZA's AI still did the work (only the first ${FREE_EMPTY_RESULTS_PER_DAY} a day are refunded).`;
}
