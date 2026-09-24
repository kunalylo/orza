import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { searchFoods } from "@/lib/nutrition";

const Query = z.object({
  q: z
    .string()
    .trim()
    .min(1, "Type a food to search")
    .max(60, "Please keep the search under 60 characters"),
});

/**
 * GET /api/foods/search?q= — autocomplete over ÖRZA's built-in food list (top 10).
 * The list is static and identical for every user, so results are briefly cacheable per browser.
 */
export const GET = route(async (req: Request) => {
  await requireUser();
  const { q } = Query.parse({ q: new URL(req.url).searchParams.get("q") ?? "" });
  const foods = searchFoods(q, 10).map((f) => ({
    key: f.key,
    name: f.name,
    serving: f.serving,
    per_serving: f.per_serving,
    diet: f.diet,
    category: f.category,
    ...(f.restaurant_multiplier ? { restaurant_multiplier: f.restaurant_multiplier } : {}),
  }));
  return json({ foods }, { headers: { "Cache-Control": "private, max-age=300" } });
});
