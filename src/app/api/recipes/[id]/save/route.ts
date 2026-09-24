import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, notFound, parseBody, route } from "@/lib/http";
import type { StoredRecipe } from "@/lib/recipes-library";

export const dynamic = "force-dynamic";

const Body = z.object({ saved: z.boolean({ required_error: "saved is required", invalid_type_error: "saved must be true or false" }) });

/** POST /api/recipes/[id]/save { saved } → { recipe } (owner only). */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { saved } = await parseBody(req, Body);
  const recipe = await col<StoredRecipe>("recipes").findOneAndUpdate({ id: String(id), user_id: user.id }, { $set: { saved } });
  if (!recipe) throw notFound("That recipe doesn't exist anymore.");
  return json({ recipe });
});
