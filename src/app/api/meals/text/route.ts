import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { withCredits } from "@/lib/credits";
import { createMeal, guessMealType } from "@/lib/domain/meals";
import { HttpError, json, parseBody, route } from "@/lib/http";
import { aiParseMealText } from "@/lib/meal-ai";
import { parseMealText } from "@/lib/nutrition";
import type { MealItem, MealType } from "@/lib/types";
import { AI_GUARD, emptyResultCreditNote, refundEmptyResult, reserveAi } from "@/lib/ai-guard";
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
 * With AI on: 1 credit via withCredits, rate-limited per user (see @/lib/ai-guard). A completed AI call
 * that finds no food is refunded only within the daily allowance. Without AI (or if the AI is
 * unavailable, busy for this user, out of credits or finds nothing) the free built-in parser logs it,
 * with a `notice` explaining why. The parser uses the profile diet, so "biryani" is Veg Biryani for a vegetarian.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const date = resolveDate(user, body.date);
  const diet = user.profile?.diet ?? null;

  let items: MealItem[] = [];
  let unmatched: string[] = [];
  let parsedType: MealType | undefined;
  let notes: string | undefined;
  let ai = false;
  let notice: string | undefined;
  let credits: number | undefined;
  /** Set when the AI ran to completion but found no food: whether its credit was given back. */
  let emptyAiRefunded: boolean | undefined;

  if (aiEnabled()) {
    const release = await reserveAi(user.id, "meal_text");
    if (!release) {
      notice = "You're logging faster than ÖRZA's AI can keep up, so this one used the built-in food list (free).";
    } else {
      try {
        // Only AI failures (timeouts, outages) throw in here, so only they are refunded by withCredits.
        const out = await withCredits(
          user.id,
          "meal_text",
          () => aiParseMealText(body.text, user.profile),
          AI_GUARD.meal_text.reason
        );
        if (out.items.length) {
          items = out.items;
          unmatched = out.unmatched;
          parsedType = out.meal_type;
          notes = out.notes || undefined;
          ai = true;
        } else {
          // The AI did the work (and was paid for) — refund within the daily allowance only.
          emptyAiRefunded = await refundEmptyResult(user.id, "meal_text");
        }
      } catch (e) {
        if (!(e instanceof HttpError)) throw e;
        if (e.code === "no_credits") {
          notice = "You're out of AI credits, so ÖRZA used its built-in Indian food list (free). Top up any time for AI-level detail.";
        } else if (e.status >= 502 && e.status <= 504) {
          notice = "ÖRZA's AI was unavailable, so this was logged with the built-in food list. No credits were used.";
        } else {
          throw e;
        }
        // Fall through to the deterministic parser below.
      } finally {
        release();
      }
    }
    credits = await currentCredits(user.id);
  }

  if (!ai) {
    const parsed = parseMealText(body.text, { diet });
    items = parsed.items;
    unmatched = parsed.unmatched;
    parsedType = parsed.mealType;
  } else if (!parsedType) {
    // Cheap deterministic pass just to pick up "breakfast/nashta/raat" cues the AI left out.
    parsedType = parseMealText(body.text, { diet }).mealType;
  }

  if (!items.length) {
    const creditNote = emptyAiRefunded != null ? ` ${emptyResultCreditNote("meal_text", emptyAiRefunded)}` : "";
    throw new HttpError(422, `${NOTHING_RECOGNISED}.${creditNote}`, "no_items");
  }
  if (emptyAiRefunded != null) {
    notice = `ÖRZA's AI couldn't read that clearly, so the built-in food list logged it — please check the items. ${emptyResultCreditNote(
      "meal_text",
      emptyAiRefunded
    )}`;
  }

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
