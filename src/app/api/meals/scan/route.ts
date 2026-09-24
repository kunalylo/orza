import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { sumNutrients } from "@/lib/domain/meals";
import { HttpError, json, parseBody, route } from "@/lib/http";
import { aiScanImage, type MealAIResult } from "@/lib/meal-ai";
import type { Scan } from "@/lib/types";
import { MEAL_AI, emptyResultCreditNote, rateLimited, refundEmptyResult, reserveMealAi } from "../_ai-guard";
import { currentCredits } from "../_shared";

/** ≈ 6 MB of image bytes once base64-encoded (4/3 overhead) plus the data-URL prefix. */
const MAX_IMAGE_CHARS = 8_500_000;

const Body = z.object({
  image: z
    .string({ required_error: "Please add a photo of your meal" })
    .min(200, "That photo looks empty — please try another")
    .max(MAX_IMAGE_CHARS, "That photo is too large — please use one under 6 MB")
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/, "Please upload a JPEG, PNG or WEBP photo"),
  note: z.string().trim().max(200, "Keep the note under 200 characters").optional(),
});

/**
 * POST /api/meals/scan — Snap & Know. Costs 2 credits: refunded if the AI fails, and refunded for
 * photos with no food up to a daily allowance (see _ai-guard). Rate-limited per user (429).
 * The photo is only sent to the AI; it is never stored. Returns an unconfirmed Scan to review.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  if (!aiEnabled()) {
    throw new HttpError(
      503,
      "Photo scanning needs ÖRZA's AI, which isn't switched on yet. You can type or speak your meal instead.",
      "ai_disabled"
    );
  }
  const body = await parseBody(req, Body);

  const release = await reserveMealAi(user.id, "scan");
  if (!release) throw rateLimited();
  let result: MealAIResult;
  try {
    // Only AI failures throw in here, so only they are refunded by withCredits.
    result = await withCredits(user.id, "scan", () => aiScanImage(body.image, body.note, user.profile), MEAL_AI.scan.reason);
  } finally {
    release();
  }

  if (!result.items.length) {
    // The AI did look at the photo (and was paid for) — refund within the daily allowance only.
    const refunded = await refundEmptyResult(user.id, "scan");
    const why = result.notes || "ÖRZA couldn't spot any food in that photo. Try a clear, well-lit shot of the whole plate.";
    throw new HttpError(422, `${why} ${emptyResultCreditNote("scan", refunded)}`, "no_food");
  }

  const scan: Scan = {
    id: newId(),
    user_id: user.id,
    items: result.items,
    totals: sumNutrients(result.items),
    dish_name: result.dish_name,
    notes: result.notes || undefined,
    confidence: result.confidence,
    confirmed: false,
    created_at: nowISO(),
  };
  await col<Scan>("scans").insertOne(scan);

  return json({ scan, credits: (await currentCredits(user.id)) ?? user.credits });
});
