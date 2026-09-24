import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { CREDIT_COSTS } from "@/lib/credits";
import { col } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { StoredRecipe } from "@/lib/recipes-library";

export const dynamic = "force-dynamic";

const LIMIT = 60;

/**
 * GET /api/recipes → { recipes } newest first (latest 60, plus any older saved
 * recipes so the Saved tab is always complete). Also reports whether AI is on
 * and what a generation costs, so the UI can label the button honestly.
 */
export const GET = route(async () => {
  const user = await requireUser();
  const recipes = col<StoredRecipe>("recipes");
  const [recent, saved] = await Promise.all([
    recipes.find({ user_id: user.id }, { sort: { created_at: -1 }, limit: LIMIT }),
    recipes.find({ user_id: user.id, saved: true }, { sort: { created_at: -1 }, limit: LIMIT }),
  ]);
  const byId = new Map<string, StoredRecipe>();
  for (const r of [...recent, ...saved]) byId.set(r.id, r);
  const list = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return json({ recipes: list, ai_enabled: aiEnabled(), cost: CREDIT_COSTS.recipe });
});
