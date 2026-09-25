import { z } from "zod";
import { avoidList, memoryDiets } from "@/lib/allergens";
import { requireUser } from "@/lib/auth";
import { aiEnabled, aiJSON } from "@/lib/ai";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { guessMealType } from "@/lib/domain/meals";
import { resolveTargets } from "@/lib/reports";
import { HttpError, json, parseBody, route } from "@/lib/http";
import {
  DIET_TAGS,
  deriveTags,
  pickRecipe,
  promptConstraints,
  recipeViolations,
  type PickResult,
  type StoredRecipe,
} from "@/lib/recipes-library";
import type { Diet, Nutrients, User } from "@/lib/types";
import { round } from "@/lib/utils";

export const dynamic = "force-dynamic";

const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

const Body = z.object({
  prompt: optional(z.string().trim().max(300, "Keep your request under 300 characters")),
  max_calories: optional(
    z.coerce
      .number({ invalid_type_error: "Max calories must be a number" })
      .int("Use a whole number of calories")
      .min(150, "Max calories should be at least 150")
      .max(1500, "Max calories should be at most 1500")
  ),
  cuisine: optional(z.string().trim().max(40, "Keep the cuisine under 40 characters")),
  diet: optional(z.enum(["vegetarian", "vegan", "eggetarian", "non_vegetarian", "jain"], { errorMap: () => ({ message: "Choose a valid diet" }) })),
});

/** Keep this many unsaved recipes per person; older unsaved ones are pruned. */
const KEEP_UNSAVED = 60;

type Draft = Pick<StoredRecipe, "title" | "cuisine" | "description" | "prep_minutes" | "servings" | "ingredients" | "steps" | "nutrition" | "tags">;

/* ───────────────────────────── AI output cleaning ───────────────────────────── */

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number, digits = 0): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? round(Math.min(max, Math.max(min, n)), digits) : null;
};
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Tags we always derive ourselves from ingredients/nutrition — never trusted from the model. */
const DERIVED = new Set<string>([
  ...DIET_TAGS,
  "non-vegetarian",
  "veg",
  "non-veg",
  "high-protein",
  "low-carb",
  "low-calorie",
  "high-fibre",
  "high-fiber",
  "quick",
  "gluten-free",
  "dairy-free",
]);

function ingredientLine(v: unknown): string {
  if (typeof v === "string") return text(v, 140);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return text([o.quantity ?? o.qty ?? o.amount, o.unit, o.name ?? o.item ?? o.ingredient].filter((x) => x != null && x !== "").join(" "), 140);
  }
  return "";
}

/** Normalise the model's JSON into a Recipe draft, or null when it's unusable. */
function cleanAiRecipe(raw: any, fallbackCuisine?: string): Draft | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw.recipe && typeof raw.recipe === "object" ? raw.recipe : raw;
  const title = text(r.title ?? r.name ?? r.recipe_name, 90);
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).map(ingredientLine).filter(Boolean).slice(0, 25);
  const steps = (Array.isArray(r.steps) ? r.steps : Array.isArray(r.instructions) ? r.instructions : [])
    .map((s: unknown) => text(s, 400).replace(/^(step\s*)?\d+\s*[.):-]\s*/i, ""))
    .filter(Boolean)
    .slice(0, 15);
  if (title.length < 3 || ingredients.length < 3 || steps.length < 2) return null;

  const n = r.nutrition && typeof r.nutrition === "object" ? r.nutrition : r;
  const protein_g = num(n.protein_g ?? n.protein, 0, 200, 1) ?? 0;
  const carbs_g = num(n.carbs_g ?? n.carbs ?? n.carbohydrates_g, 0, 400, 1) ?? 0;
  const fat_g = num(n.fat_g ?? n.fat, 0, 200, 1) ?? 0;
  const fiber_g = num(n.fiber_g ?? n.fibre_g ?? n.fiber ?? n.fibre, 0, 80, 1) ?? 0;
  const fromMacros = protein_g * 4 + carbs_g * 4 + fat_g * 9;
  let calories = num(n.calories ?? n.kcal ?? r.calories_per_serving, 0, 2500) ?? 0;
  // Keep calories honest with the macros the model gave.
  if (fromMacros > 0 && (!calories || Math.abs(calories - fromMacros) / fromMacros > 0.3)) calories = Math.round(fromMacros);
  if (calories < 40) return null;
  const nutrition: Nutrients = { calories, protein_g, carbs_g, fat_g, fiber_g };

  const prep_minutes = num(r.prep_minutes ?? r.total_minutes ?? r.prep_time_mins, 5, 240) ?? 30;
  const servings = num(r.servings, 1, 12) ?? 2;
  const cuisine = text(r.cuisine, 40) || text(fallbackCuisine, 40) || "Indian";
  const aiTags = (Array.isArray(r.tags) ? r.tags : [])
    .map((t: unknown) => slug(text(t, 30)))
    .filter((t: string) => t.length >= 3 && !DERIVED.has(t))
    .slice(0, 4);
  const tags = [...new Set([slug(cuisine), ...deriveTags({ ingredients, nutrition, prep_minutes }), ...aiTags])].filter(Boolean);

  return {
    title,
    cuisine,
    description: text(r.description, 280) || `A home-style ${cuisine} recipe, personalised by ÖRZA.`,
    prep_minutes,
    servings,
    ingredients,
    steps,
    nutrition,
    tags,
  };
}

const DIET_RULES =
  "Diet rules: vegan = no animal products at all (no dairy, ghee, paneer, curd, honey, eggs, meat or fish); " +
  "vegetarian = no meat, fish or eggs (dairy is fine); eggetarian = vegetarian plus eggs; " +
  "jain = vegetarian with NO onion, garlic, potato, carrot, beetroot, radish, fresh ginger, mushrooms, other root vegetables or honey (dry ginger powder and hing are fine); " +
  "non_vegetarian = anything.";

async function aiRecipe(input: {
  user: User;
  prompt?: string;
  cuisine?: string;
  cap?: number;
  diets: Diet[];
  avoid: string[];
  recentTitles: string[];
}): Promise<Draft> {
  const p = input.user.profile || {};
  const t = resolveTargets(input.user);
  const res = await aiJSON<any>({
    system:
      "You are ÖRZA's recipe creator. Create ONE practical, home-style recipe personalised to this person. " +
      "Prefer Indian regional home cooking (respect their region) unless they ask for another cuisine. " +
      `${DIET_RULES} Follow every listed diet and never include any listed allergy or avoided food, not even as a garnish, optional topping or serving suggestion. ` +
      "Don't name an excluded food anywhere in the recipe — not in the title, description or steps, and not as a swap (\"instead of paneer\"). " +
      "Ingredients must include quantities for the stated servings. Steps are short, clear imperative sentences (4–8 steps). " +
      "Nutrition is per serving and must be realistic (IFCT/USDA-based estimates) and consistent with the macros. " +
      "If a calorie cap is given, the per-serving calories must stay under it. Don't repeat any of the recent recipes. " +
      "Write in clear English; Indian dish names are welcome. Tags are short lowercase words like 'breakfast', 'tiffin', 'one-pot', 'comfort'.",
    prompt: JSON.stringify({
      request: input.prompt || "A healthy, balanced recipe that fits my goals",
      cuisine: input.cuisine || undefined,
      max_calories_per_serving: input.cap,
      diets: input.diets.length ? input.diets : ["no restriction"],
      allergies_and_foods_to_avoid: input.avoid,
      region: p.region,
      goal: p.goal,
      daily_targets: { calories: t.calories, protein_g: t.protein_g, fiber_g: t.fiber_g },
      household_mode: p.household_mode,
      recent_recipes: input.recentTitles,
    }),
    shape:
      '{ "title": string, "cuisine": string, "description": string (1–2 warm sentences), "prep_minutes": number (total time), "servings": number, ' +
      '"ingredients": string[] (each with quantity, e.g. "1 cup yellow moong dal"), "steps": string[], ' +
      '"nutrition": { "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number } (per serving), "tags": string[] }',
    temperature: 0.7,
    maxTokens: 1500,
  });

  const draft = cleanAiRecipe(res, input.cuisine);
  if (!draft) throw new HttpError(502, "ÖRZA's AI returned an incomplete recipe.", "ai_parse");
  // Never show a recipe that breaks the person's diet or allergies — fall back to the curated collection instead.
  const problems = recipeViolations(draft, { diets: input.diets, allergies: input.avoid });
  if (problems.length) throw new HttpError(502, `The AI recipe didn't fit your needs (${problems.join(", ")}).`, "ai_unsafe");
  if (input.cap && draft.nutrition.calories > input.cap * 1.1) throw new HttpError(502, "The AI recipe went over your calorie cap.", "ai_calories");
  return draft;
}

/* ───────────────────────────── Library path ───────────────────────────── */

function relaxedNotice(pick: PickResult, cuisine?: string): string | undefined {
  const c = pick.relaxed.includes("cuisine");
  const k = pick.relaxed.includes("calories");
  const what = cuisine ? `${cuisine} recipe` : "recipe";
  if (c && k) return `ÖRZA's collection doesn't have a ${what} under ${pick.max_calories} kcal that fits your diet yet, so here's the closest light option.`;
  if (c) return `ÖRZA's collection doesn't have a ${what} that fits your diet yet, so here's the closest match.`;
  if (k) return `Nothing in ÖRZA's collection fits under ${pick.max_calories} kcal for your diet, so here's the lightest match.`;
  return undefined;
}

/* ───────────────────────────── Route ───────────────────────────── */

/**
 * POST /api/recipes/generate → { recipe, ai, credits?, notice? }.
 * AI (2 credits) when configured, vetted against diet + allergies; otherwise — or if the AI
 * result can't be used — a deterministic pick from ÖRZA's curated library (free).
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const profile = user.profile || {};

  const fromPrompt = promptConstraints(body.prompt);
  const diet = body.diet ?? profile.diet;
  // Diets told to ÖRZA in chat ("I'm vegan") count too, unless a diet was picked for this request.
  const learnedDiets = body.diet ? [] : memoryDiets(user.memory);
  const diets = [...new Set<Diet>([...(diet ? [diet] : []), ...learnedDiets, ...fromPrompt.diets])];
  // Profile allergies plus allergies/avoided foods learned in chat ("Allergic to cashews").
  const allergies = avoidList(profile.allergies, user.memory).filter((a) => a.trim().toLowerCase() !== "none");
  const avoid = [...new Set([...allergies, ...fromPrompt.avoid])];
  const cap = body.max_calories ?? fromPrompt.max_calories;

  const store = col<StoredRecipe>("recipes");
  const recent = await store.find({ user_id: user.id }, { sort: { created_at: -1 }, limit: 12 });

  let draft: Draft | null = null;
  let libraryKey: string | undefined;
  let credits: number | undefined;
  const notices: string[] = [];

  if (aiEnabled()) {
    try {
      draft = await withCredits(
        user.id,
        "recipe",
        () => aiRecipe({ user, prompt: body.prompt, cuisine: body.cuisine, cap, diets, avoid, recentTitles: recent.map((r) => r.title) }),
        `Recipe: ${(body.prompt || body.cuisine || "personalised recipe").slice(0, 60)}`
      );
      credits = (await col<User>("users").findOne({ id: user.id }))?.credits;
    } catch (e) {
      if (!(e instanceof HttpError)) console.error("[orza] recipe AI failed", e);
      notices.push(
        e instanceof HttpError && e.code === "no_credits"
          ? "You're out of AI credits, so here's a recipe from ÖRZA's curated collection."
          : "ÖRZA's AI couldn't create a recipe that fits right now, so here's one from the curated collection. No credits were used."
      );
    }
  }

  if (!draft) {
    const pick = pickRecipe({
      prompt: body.prompt,
      max_calories: body.max_calories,
      cuisine: body.cuisine,
      diet,
      diets: learnedDiets,
      allergies,
      excludeKeys: recent.map((r) => r.library_key).filter((k): k is string => !!k),
      region: profile.region,
      mealHint: guessMealType(profile.timezone),
    });
    if (!pick) {
      throw new HttpError(
        422,
        "ÖRZA couldn't find a recipe that fits your diet and allergies for that request. Try different words or another cuisine.",
        "no_match"
      );
    }
    const r = pick.recipe;
    draft = {
      title: r.title,
      cuisine: r.cuisine,
      description: r.description,
      prep_minutes: r.prep_minutes,
      servings: r.servings,
      ingredients: r.ingredients,
      steps: r.steps,
      nutrition: r.nutrition,
      tags: r.tags,
    };
    libraryKey = r.key;
    const relaxed = relaxedNotice(pick, body.cuisine);
    if (relaxed) notices.push(relaxed);
  }

  const recipe: StoredRecipe = {
    id: newId(),
    user_id: user.id,
    ...draft,
    saved: false,
    source: libraryKey ? "library" : "ai",
    ...(libraryKey ? { library_key: libraryKey } : {}),
    ...(body.prompt ? { prompt: body.prompt } : {}),
    created_at: nowISO(),
  };
  await store.insertOne(recipe);

  // Keep the Recent list tidy: prune the oldest unsaved recipes.
  const stale = await store.find({ user_id: user.id, saved: false }, { sort: { created_at: -1 }, skip: KEEP_UNSAVED });
  if (stale.length) await store.deleteMany({ user_id: user.id, saved: false, id: { $in: stale.map((s) => s.id) } });

  return json({
    recipe,
    ai: recipe.source === "ai",
    ...(credits != null ? { credits } : {}),
    ...(notices.length ? { notice: notices.join(" ") } : {}),
  });
});
