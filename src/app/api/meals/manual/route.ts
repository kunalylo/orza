import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createMeal, guessMealType } from "@/lib/domain/meals";
import { json, notFound, parseBody, route } from "@/lib/http";
import { FOODS, nutrientsFor } from "@/lib/nutrition";
import type { MealItem } from "@/lib/types";
import { round } from "@/lib/utils";
import { itemsSchema, mealTypeSchema, optionalDate, resolveDate, userTz } from "../_shared";

const Base = z.object({ date: optionalDate, meal_type: mealTypeSchema.nullish() });

/** One food from ÖRZA's list, in servings (e.g. 1.5 × "1 katori"). */
const ByFood = Base.extend({
  food_key: z.string().trim().min(1, "Choose a food").max(80),
  quantity: z
    .number({ required_error: "Choose how many servings", invalid_type_error: "Servings must be a number" })
    .finite()
    .positive("Servings must be more than 0")
    .max(20, "That's a lot of servings — up to 20 at a time"),
  restaurant: z.boolean().optional(),
});

/** Free-form items (e.g. a packaged food with a nutrition label). */
const ByItems = Base.extend({ items: itemsSchema });

const fmtQty = (q: number) => String(round(q, 2));

/** POST /api/meals/manual — log from the food list or custom items. Always free (no AI). */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const raw = await parseBody(req, z.record(z.unknown()));
  const mealTypeFallback = () => guessMealType(userTz(user));

  if ("food_key" in raw) {
    const body = ByFood.parse(raw);
    const date = resolveDate(user, body.date);
    const food = FOODS.find((f) => f.key === body.food_key);
    if (!food) throw notFound("That food isn't in ÖRZA's list — please search again.");
    const restaurant = !!body.restaurant;
    const name = restaurant ? `${food.name} (restaurant)` : food.name;
    const item: Partial<MealItem> = {
      name,
      quantity: body.quantity,
      unit: food.serving.unit,
      grams: Math.round(food.serving.grams * body.quantity),
      ...nutrientsFor(food, body.quantity, restaurant),
    };
    const meal = await createMeal({
      userId: user.id,
      date,
      mealType: body.meal_type || mealTypeFallback(),
      source: "manual",
      description: `${fmtQty(body.quantity)} ${food.serving.unit} ${name}`,
      items: [item],
    });
    return json({ meal });
  }

  const body = ByItems.parse(raw);
  const date = resolveDate(user, body.date);
  const meal = await createMeal({
    userId: user.id,
    date,
    mealType: body.meal_type || mealTypeFallback(),
    source: "manual",
    description: body.items.map((i) => i.name).join(", "),
    items: body.items,
  });
  return json({ meal });
});
