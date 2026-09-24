import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { createMeal, guessMealType } from "@/lib/domain/meals";
import { HttpError, json, notFound, parseBody, route } from "@/lib/http";
import type { Scan } from "@/lib/types";
import { itemsSchema, mealTypeSchema, optionalDate, resolveDate, userTz } from "../../../_shared";

const Body = z.object({
  meal_type: mealTypeSchema.nullish(),
  date: optionalDate,
  items: itemsSchema.optional(),
});

/**
 * POST /api/meals/scan/[id]/confirm — turn a reviewed scan into a logged meal (source "photo").
 * Owner only; each scan can be confirmed once (claimed atomically to avoid double logging).
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await parseBody(req, Body);
  const date = resolveDate(user, body.date);

  const scans = col<Scan>("scans");
  const scan = await scans.findOne({ id, user_id: user.id });
  if (!scan) throw notFound("We couldn't find that scan. Please scan the photo again.");
  if (scan.confirmed) throw new HttpError(409, "This scan has already been logged.", "already_confirmed");

  const items = body.items ?? scan.items;
  if (!items.length) throw new HttpError(400, "Add at least one item before logging.", "bad_request");

  const claimed = await scans.findOneAndUpdate({ id, user_id: user.id, confirmed: false }, { $set: { confirmed: true } });
  if (!claimed) throw new HttpError(409, "This scan has already been logged.", "already_confirmed");

  try {
    const meal = await createMeal({
      userId: user.id,
      date,
      mealType: body.meal_type || guessMealType(userTz(user)),
      source: "photo",
      description: scan.dish_name,
      items,
      notes: scan.notes,
    });
    await scans.updateOne({ id, user_id: user.id }, { $set: { meal_id: meal.id } });
    return json({ meal });
  } catch (e) {
    // Release the claim so the user can retry.
    await scans.updateOne({ id, user_id: user.id }, { $set: { confirmed: false } }).catch(() => {});
    throw e;
  }
});
