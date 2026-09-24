import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { withCredits } from "@/lib/credits";
import { createMeal, guessMealType } from "@/lib/domain/meals";
import { HttpError, json, parseBody, route } from "@/lib/http";
import { aiParseMealText } from "@/lib/meal-ai";
import { parseMealText } from "@/lib/nutrition";
import type { MealItem, MealType } from "@/lib/types";
import { currentCredits, mealTypeSchema, optionalDate, resolveDate, userTz } from "../_shared";

const Body = z.object({
  text: z
    .string({ required_error: "Tell ÖRZA what you ate" })
    .trim()
    .min(2, "Tell ÖRZA a little more about what you ate")
    .max(500, "Please keep it under 500 characters"),
  date: optionalDate,
  meal_type: mealTypeSchema.nullish(),
  source: z.enum(["text", "voice"]).optional(),
});

const NOTHING_RECOGNISED = "Couldn't recognise any foods — try e.g. '2 roti and 1 katori dal'";

/**
 * POST /api/meals/text — log a meal from a typed or spoken description.
 * With AI on: 1 credit via withCredits. Without AI (or if AI is unavailable / out of credits):
 * the free built-in parser, with a `notice` explaining why.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const date = resolveDate(user, body.date);

  let items: MealItem[] = [];
  let unmatched: string[] = [];
  let parsedType: MealType | undefined;
  let notes: string | undefined;
  let ai = false;
  let notice: string | undefined;
  let credits: number | undefined;

  if (aiEnabled()) {
    try {
      const out = await withCredits(
        user.id,
        "meal_text",
        async () => {
          const r = await aiParseMealText(body.text, user.profile);
          // Throwing here refunds the credit — nothing was logged.
          if (!r.items.length) throw new HttpError(422, NOTHING_RECOGNISED, "no_items");
          return r;
        },
        "Meal log (text)"
      );
      items = out.items;
      unmatched = out.unmatched;
      parsedType = out.meal_type;
      notes = out.notes || undefined;
      ai = true;
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
      if (e.code === "no_credits") {
        notice = "You're out of AI credits, so ÖRZA used its built-in Indian food list (free). Top up any time for AI-level detail.";
      } else if (e.status >= 502 && e.status <= 504) {
        notice = "ÖRZA's AI was unavailable, so this was logged with the built-in food list. No credits were used.";
      } else if (e.status !== 422) {
        throw e;
      }
      // Fall through to the deterministic parser below.
    }
    credits = await currentCredits(user.id);
  }

  if (!ai) {
    const parsed = parseMealText(body.text);
    items = parsed.items;
    unmatched = parsed.unmatched;
    parsedType = parsed.mealType;
  } else if (!parsedType) {
    // Cheap deterministic pass just to pick up "breakfast/nashta/raat" cues the AI left out.
    parsedType = parseMealText(body.text).mealType;
  }

  if (!items.length) throw new HttpError(422, NOTHING_RECOGNISED, "no_items");

  const meal = await createMeal({
    userId: user.id,
    date,
    mealType: body.meal_type || parsedType || guessMealType(userTz(user)),
    source: body.source === "voice" ? "voice" : "text",
    description: body.text,
    items,
    notes,
  });

  return json({
    meal,
    ai,
    unmatched,
    ...(credits != null ? { credits } : {}),
    ...(notice ? { notice } : {}),
  });
});
