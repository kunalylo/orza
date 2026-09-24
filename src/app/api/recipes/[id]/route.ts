import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, notFound, route } from "@/lib/http";
import type { StoredRecipe } from "@/lib/recipes-library";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/recipes/[id] → { recipe } (owner only). */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const recipe = await col<StoredRecipe>("recipes").findOne({ id: String(id), user_id: user.id });
  if (!recipe) throw notFound("That recipe doesn't exist anymore.");
  return json({ recipe });
});

/** DELETE /api/recipes/[id] → { ok } (owner only). */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const deleted = await col<StoredRecipe>("recipes").deleteOne({ id: String(id), user_id: user.id });
  if (!deleted) throw notFound("That recipe doesn't exist anymore.");
  return json({ ok: true });
});
