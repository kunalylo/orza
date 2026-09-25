import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled, aiJSON } from "@/lib/ai";
import { allergyList, avoidList, conflictsWithAllergies } from "@/lib/allergens";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { addDays, dateInTz } from "@/lib/dates";
import { HttpError, json, parseBody, route } from "@/lib/http";
import type { CompensationDay, User } from "@/lib/types";
import {
  DEFAULT_DIET,
  estimateExtraDetails,
  mealIdeaIsSafe,
  planCompensation,
  type CompensationDraft,
  type StoredCompensationPlan,
} from "@/lib/compensation";

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

const SLOTS = ["Breakfast", "Lunch", "Dinner"] as const;
const LABEL_RE = /^\s*(breakfast|lunch|dinner)\s*[:\-–—]\s*/i;

/**
 * Merge one day's AI meal ideas into the built-in ones, slot by slot. An AI idea is used only when it
 * passes the same diet + avoid-list check as the built-in ideas; otherwise the built-in idea stays.
 */
function vetMeals(aiMeals: string[], builtIn: string[], safe: (text: string) => boolean): { meals: string[]; accepted: number } {
  let accepted = 0;
  const meals = builtIn.map((fallback, i) => {
    const slot = SLOTS[i];
    if (!slot) return fallback;
    const labelled = aiMeals.find((m) => LABEL_RE.exec(m)?.[1].toLowerCase() === slot.toLowerCase());
    const candidate = labelled ?? (aiMeals[i] && !LABEL_RE.test(aiMeals[i]) ? aiMeals[i] : undefined);
    const body = candidate ? candidate.replace(LABEL_RE, "").trim() : "";
    if (body.length < 4 || !safe(body)) return fallback;
    accepted++;
    return `${slot}: ${body}`;
  });
  return { meals, accepted };
}

/**
 * Personalise wording only — every number stays from the deterministic plan, and every AI meal idea
 * is re-checked against the user's diet and avoid-list before it replaces a built-in one.
 * Throws (so `withCredits` refunds the credit) when nothing usable came back.
 */
async function personalise(
  draft: CompensationDraft,
  user: User,
  avoid: string[],
  occasion: string,
  description?: string
): Promise<{ message: string; days: CompensationDay[] }> {
  const p = user.profile || {};
  const diet = p.diet || DEFAULT_DIET;
  const res = await aiJSON<AiRewrite>({
    system:
      "You personalise ÖRZA's 'compassionate rebalancing' plans after a special meal. Rewrite ONLY the supportive message and each day's three meal ideas. " +
      "Keep every number in the plan exactly as given (calorie targets, adjustments, steps, minutes) and never introduce new calorie numbers. " +
      "Meal ideas must be light, home-style, realistic for the user's region, strictly within their diet (Jain: no onion, garlic, potato or other root vegetables; vegetarian: no egg, meat or fish; vegan: no dairy either), and must never include anything in allergies_and_foods_to_avoid. Prefix each idea with 'Breakfast: ', 'Lunch: ' or 'Dinner: '. " +
      "Never suggest skipping meals, fasting, detoxes, compensatory exercise punishment or anything that sounds like guilt. The message is 2–4 warm sentences.",
    prompt: JSON.stringify({
      user: {
        first_name: (user.name || "").split(/\s+/)[0] || undefined,
        diet,
        allergies_and_foods_to_avoid: allergyList(avoid) || "none",
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
    for (const d of res.days as unknown[]) {
      const day = d as { date?: unknown; meals?: unknown } | null;
      if (!day || typeof day.date !== "string" || !Array.isArray(day.meals)) continue;
      const meals = day.meals.map((m: unknown) => clean(m, 160)).filter(Boolean).slice(0, 3);
      if (meals.length) byDate.set(day.date, meals);
    }
  }

  const safe = (text: string) => mealIdeaIsSafe(text, { diet, avoid });
  let accepted = 0;
  let rejected = 0;
  const days = draft.days.map((d) => {
    const aiMeals = byDate.get(d.date);
    if (!aiMeals) return d;
    const out = vetMeals(aiMeals, d.meals, safe);
    accepted += out.accepted;
    rejected += aiMeals.length - out.accepted;
    return { ...d, meals: out.meals };
  });
  if (rejected) console.warn(`[orza] compensation: kept ${rejected} built-in meal idea(s) in place of AI ideas that didn't fit the diet/avoid-list`);

  const aiMessage = clean(res?.message, 700);
  const messageOk = aiMessage.length >= 20 && !conflictsWithAllergies(aiMessage, avoid);
  if (!messageOk && !accepted) throw new Error("AI rebalance output was unusable for this user's diet/avoid-list");
  return { message: messageOk ? aiMessage : draft.message, days };
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

  // Allergies plus avoid-facts learned in chat ("Doesn't eat mushrooms") — kept out of every meal idea.
  const avoid = avoidList(user.profile?.allergies, user.memory);

  const draft = planCompensation({
    extra_calories: extra,
    days: body.days ?? 3,
    targets: user.targets,
    profile: user.profile || {},
    startDate: addDays(today, 1),
    occasion: body.occasion,
    name: user.name,
    avoid,
  });

  let message = draft.message;
  let days = draft.days;
  let ai = false;
  let credits: number | undefined;
  let notice: string | undefined;

  if (aiEnabled()) {
    try {
      const out = await withCredits(user.id, "compensation", () => personalise(draft, user, avoid, body.occasion, body.description), `Rebalance plan: ${body.occasion}`);
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
