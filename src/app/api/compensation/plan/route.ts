import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled, aiJSON } from "@/lib/ai";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { addDays, dateInTz } from "@/lib/dates";
import { HttpError, json, parseBody, route } from "@/lib/http";
import type { CompensationDay, User } from "@/lib/types";
import { estimateExtraDetails, planCompensation, type CompensationDraft, type StoredCompensationPlan } from "@/lib/compensation";

export const dynamic = "force-dynamic";

const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

const Body = z.object({
  occasion: z.string().trim().min(2, "Tell ÖRZA the occasion (at least 2 characters)").max(80, "Keep the occasion under 80 characters"),
  description: optional(z.string().trim().max(500, "Keep the description under 500 characters")),
  extra_calories: optional(z.coerce.number().int("Use a whole number of calories").min(100, "Extra calories should be at least 100").max(5000, "Extra calories should be at most 5000")),
  days: optional(z.coerce.number().int().min(2, "Spread the plan over 2–5 days").max(5, "Spread the plan over 2–5 days")),
});

type AiRewrite = { message?: unknown; days?: unknown };

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Personalise wording only — every number stays from the deterministic plan. */
async function personalise(draft: CompensationDraft, user: User, occasion: string, description?: string): Promise<{ message: string; days: CompensationDay[] }> {
  const p = user.profile || {};
  const res = await aiJSON<AiRewrite>({
    system:
      "You personalise ÖRZA's 'compassionate rebalancing' plans after a special meal. Rewrite ONLY the supportive message and each day's three meal ideas. " +
      "Keep every number in the plan exactly as given (calorie targets, adjustments, steps, minutes) and never introduce new calorie numbers. " +
      "Meal ideas must be light, home-style, realistic for the user's region and diet, and must avoid their allergies. Prefix each idea with 'Breakfast: ', 'Lunch: ' or 'Dinner: '. " +
      "Never suggest skipping meals, fasting, detoxes, compensatory exercise punishment or anything that sounds like guilt. The message is 2–4 warm sentences.",
    prompt: JSON.stringify({
      user: {
        first_name: (user.name || "").split(/\s+/)[0] || undefined,
        diet: p.diet || "vegetarian",
        allergies: p.allergies || [],
        region: p.region,
        language: p.language || "en",
        tone: user.preferences?.tone || "gentle",
        goal: p.goal,
      },
      occasion,
      what_they_ate: description || undefined,
      plan: {
        extra_calories: draft.extra_calories,
        days: draft.days.map((d) => ({ date: d.date, calorie_target: d.calorie_target, adjustment: d.adjustment, focus: d.focus, activity: d.activity, meals: d.meals })),
        draft_message: draft.message,
      },
    }),
    shape: '{ "message": string, "days": [ { "date": "YYYY-MM-DD", "meals": [string, string, string] } ] }',
    temperature: 0.5,
    maxTokens: 900,
  });

  const byDate = new Map<string, string[]>();
  if (Array.isArray(res?.days)) {
    for (const d of res.days as any[]) {
      if (!d || typeof d.date !== "string" || !Array.isArray(d.meals)) continue;
      const meals = d.meals.map((m: unknown) => clean(m, 160)).filter(Boolean).slice(0, 3);
      if (meals.length >= 2) byDate.set(d.date, meals);
    }
  }
  const message = clean(res?.message, 700);
  return {
    message: message.length >= 20 ? message : draft.message,
    days: draft.days.map((d) => ({ ...d, meals: byDate.get(d.date) || d.meals })),
  };
}

/**
 * Create a rebalance plan. Always deterministic first; when AI is configured the
 * wording is personalised for 1 credit (falls back to the deterministic plan on any AI error).
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const today = dateInTz(user.profile?.timezone);

  const estimate = body.extra_calories == null ? estimateExtraDetails(body.description, user.targets) : null;
  const extra = body.extra_calories ?? estimate!.calories;

  const draft = planCompensation({
    extra_calories: extra,
    days: body.days ?? 3,
    targets: user.targets,
    profile: user.profile || {},
    startDate: addDays(today, 1),
    occasion: body.occasion,
    name: user.name,
  });

  let message = draft.message;
  let days = draft.days;
  let ai = false;
  let credits: number | undefined;
  let notice: string | undefined;

  if (aiEnabled()) {
    try {
      const out = await withCredits(user.id, "compensation", () => personalise(draft, user, body.occasion, body.description), `Rebalance plan: ${body.occasion}`);
      message = out.message;
      days = out.days;
      ai = true;
      credits = (await col<User>("users").findOne({ id: user.id }))?.credits;
    } catch (e) {
      if (!(e instanceof HttpError)) console.error("[orza] compensation AI failed", e);
      notice =
        e instanceof HttpError && e.code === "no_credits"
          ? "You're out of AI credits, so here's ÖRZA's built-in plan — just as caring, a little less personal."
          : "ÖRZA's AI was busy, so here's the built-in plan. No credits were used.";
    }
  }

  const plan: StoredCompensationPlan = {
    id: newId(),
    user_id: user.id,
    occasion: body.occasion,
    ...(body.description ? { description: body.description } : {}),
    extra_calories: draft.extra_calories,
    days,
    message,
    summary: draft.summary,
    ai,
    estimated: !!estimate,
    created_at: nowISO(),
  };
  await col<StoredCompensationPlan>("compensation_plans").insertOne(plan);

  return json({
    plan,
    ...(credits != null ? { credits } : {}),
    ...(estimate ? { estimate: { calories: estimate.calories, matched: estimate.matched, source: estimate.source } } : {}),
    ...(notice ? { notice } : {}),
  });
});
