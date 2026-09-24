import { requireUser } from "@/lib/auth";
import { listMeals, sumNutrients } from "@/lib/domain/meals";
import { json, route } from "@/lib/http";
import { resolveDate } from "./_shared";

/** GET /api/meals?date=YYYY-MM-DD → the user's meals for that day (default: today in their timezone). */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const date = resolveDate(user, new URL(req.url).searchParams.get("date"));
  const meals = await listMeals(user.id, date);
  return json({ date, meals, totals: sumNutrients(meals.map((m) => m.totals)) });
});
