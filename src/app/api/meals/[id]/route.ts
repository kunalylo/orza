import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { cleanItem, sumNutrients } from "@/lib/domain/meals";
import { json, notFound, parseBody, route } from "@/lib/http";
import type { Meal } from "@/lib/types";
import { itemsSchema, mealTypeSchema } from "../_shared";

type Ctx = { params: Promise<{ id: string }> };

const Body = z
  .object({ meal_type: mealTypeSchema.optional(), items: itemsSchema.optional() })
  .refine((b) => b.meal_type || b.items, { message: "Nothing to update — send meal_type and/or items" });

/** PATCH /api/meals/[id] — move to another meal type and/or replace items (totals are recomputed). Owner only. */
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await parseBody(req, Body);

  const set: Partial<Meal> = {};
  if (body.meal_type) set.meal_type = body.meal_type;
  if (body.items) {
    const items = body.items.map(cleanItem);
    set.items = items;
    set.totals = sumNutrients(items);
  }
  const meal = await col<Meal>("meals").findOneAndUpdate({ id, user_id: user.id }, { $set: set });
  if (!meal) throw notFound("We couldn't find that meal.");
  return json({ meal });
});

/** DELETE /api/meals/[id] — owner only. */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const deleted = await col<Meal>("meals").deleteOne({ id, user_id: user.id });
  if (!deleted) throw notFound("We couldn't find that meal.");
  return json({ ok: true });
});
