import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adjustCredits } from "@/lib/credits";
import { col } from "@/lib/db";
import { badRequest, json, notFound, parseBody, route } from "@/lib/http";
import type { User } from "@/lib/types";
import { ADJUST_LIMIT, ADJUST_REASON } from "@/components/account/options";

export const dynamic = "force-dynamic";

const Body = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Amount must be a number" })
    .int("Amount must be a whole number")
    .min(-ADJUST_LIMIT, `Amount must be between -${ADJUST_LIMIT} and ${ADJUST_LIMIT}`)
    .max(ADJUST_LIMIT, `Amount must be between -${ADJUST_LIMIT} and ${ADJUST_LIMIT}`)
    .refine((n) => n !== 0, "Amount can't be zero"),
  reason: z
    .string({ required_error: "Add a short reason" })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(ADJUST_REASON.min, `Reason must be at least ${ADJUST_REASON.min} characters`)
        .max(ADJUST_REASON.max, `Reason must be ${ADJUST_REASON.max} characters or fewer`)
    ),
});

/**
 * POST /api/admin/credits/[userId]/adjust {amount, reason} (admin only) → {balance, transaction}
 * Grants (positive) or removes (negative, floored at 0) credits and records a transaction the user can see.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ userId: string }> }) => {
  const admin = await requireAdmin();
  const { userId } = await ctx.params;
  if (!userId || userId.length > 100) throw badRequest("Invalid user id");
  const { amount, reason } = await parseBody(req, Body);

  const target = await col<User>("users").findOne({ id: userId });
  if (!target) throw notFound("User not found");
  if (amount < 0 && (target.credits ?? 0) <= 0) throw badRequest("This user has no credits to remove.");

  const result = await adjustCredits(userId, amount, reason);
  console.info("[orza] admin credit adjustment", { admin_id: admin.id, user_id: userId, requested: amount, applied: result.transaction.amount });
  return json(result);
});
