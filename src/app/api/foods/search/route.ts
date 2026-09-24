import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { searchFoods } from "@/lib/nutrition";
import { preferDietFoods } from "@/lib/nutrition/diet";

const Query = z.object({
  q: z
    .string()
    .trim()
    .min(1, "Type a food to search")
    .max(60, "Please keep the search under 60 characters"),
});

/**
 * GET /api/foods/search?q= — autocomplete over ÖRZA's built-in food list (top 10).
 * Foods that fit the user's diet come first ("biryani" → Veg Biryani for a vegetarian) unless the
 * query names meat, fish or egg. Results are briefly cacheable in the user's own browser.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const { q } = Query.parse({ q: new URL(req.url).searchParams.get("q") ?? "" });
  const ranked = preferDietFoods(searchFoods(q, 20), q, user.profile?.diet).slice(0, 10);
  const foods = ranked.map((f) => ({
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
