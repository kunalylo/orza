import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { sumNutrients } from "@/lib/domain/meals";
import { HttpError, json, parseBody, route } from "@/lib/http";
import { aiScanImage } from "@/lib/meal-ai";
import type { Scan } from "@/lib/types";
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
 * POST /api/meals/scan — Snap & Know. Costs 2 credits (refunded if the AI fails or sees no food).
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

  const result = await withCredits(
    user.id,
    "scan",
    async () => {
      const r = await aiScanImage(body.image, body.note, user.profile);
      if (!r.items.length) {
        throw new HttpError(
          422,
          r.notes || "ÖRZA couldn't spot any food in that photo. Try a clear, well-lit shot of the whole plate.",
          "no_food"
        );
      }
      return r;
    },
    "Snap & Know scan"
  );

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
