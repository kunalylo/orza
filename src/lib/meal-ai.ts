/**
 * AI meal understanding: free-text / voice meal parsing and Snap & Know photo scans.
 *
 * Both return the same sanitised shape. Routes wrap these calls in `withCredits`
 * and fall back to the deterministic parser (text) or a 503 (photos) when AI is off.
 * Output is never trusted as-is: numbers are coerced and clamped, non-food is dropped,
 * items are capped, and gaps are filled from ÖRZA's built-in food list where possible.
 */
import { aiJSON } from "@/lib/ai";
import { cleanItem } from "@/lib/domain/meals";
import { clampToItemLimits, findFood, maxServingsFor, nutrientsFor } from "@/lib/nutrition";
import type { MealItem, MealType, Profile } from "@/lib/types";
import { clamp, round } from "@/lib/utils";

export const MAX_AI_ITEMS = 15;

export interface MealAIResult {
  dish_name: string;
  items: MealItem[];
  notes: string;
  confidence: number; // 0..1
}

export interface MealTextAIResult extends MealAIResult {
  meal_type?: MealType;
  unmatched: string[];
}

/* ───────────────────────────── Prompts ───────────────────────────── */

const FOOD_KNOWLEDGE = `
PORTIONS (Indian households — use these when the user or photo gives Indian cues):
- 1 katori / small bowl ≈ 150 ml (≈150 g cooked dal, sabzi, curry, curd, kheer). "Half katori" ≈ 75 ml.
- 1 roti / chapati / phulka ≈ 30–40 g, ≈70–100 kcal without ghee; add ≈45 kcal per tsp of ghee or butter on top.
- 1 plain paratha ≈ 150–250 kcal (depends on ghee); stuffed paratha (aloo, gobhi, paneer, mooli) ≈ 250–350 kcal.
- 1 plate of rice ≈ 200–250 g cooked (≈260–330 kcal); "half plate" ≈ half of that. 1 cup ≈ 150 ml, 1 glass ≈ 250 ml, 1 tbsp ≈ 15 ml, 1 tsp ≈ 5 ml.
- Count pieces explicitly: rotis, puris, idlis, dosas, vadas, samosas, pakoras, eggs, ladoos, biscuits.
- Hindi/Hinglish numbers: ek 1, do 2, teen 3, char 4, paanch 5, aadha/half 0.5, dedh 1.5, dhai 2.5, "thoda" = a small portion.

HOME vs RESTAURANT (this is a real calorie difference — always account for it):
- Home dal uses ≈5 ml oil per katori; restaurant dal ≈30 ml oil plus butter/cream.
- Restaurant, dhaba, canteen, party/wedding and delivery (Swiggy/Zomato) versions of dals, curries, sabzis, parathas,
  biryani and fried snacks usually carry 1.4–1.8× the calories and fat of the home version. Reflect that in calories and fat_g.
- Assume home-style cooking unless there is a cue for eating out (words like restaurant, hotel, dhaba, outside, ordered,
  takeaway, delivery, party, shaadi; or in photos: glossy oil layer, butter/cream swirl, restaurant crockery).

REGIONAL & GLOBAL:
- Recognise regional Indian dishes by name and style, e.g. Punjabi dal makhani, rajma-chawal, chole bhature; Gujarati thepla,
  dhokla, undhiyu, kadhi; Maharashtrian poha, misal pav, vada pav, thalipeeth; Bengali machher jhol, luchi, shukto;
  South Indian idli, dosa, sambar, upma, appam, avial, curd rice, pongal; Hyderabadi/Lucknowi biryani; Rajasthani dal baati;
  Kashmiri rogan josh; North-East thukpa and momos; street food like pani puri, bhel, pav bhaji.
- Handle global cuisines just as well (pasta, pizza, burgers, sandwiches, salads, sushi, ramen, noodles, Mexican,
  Middle Eastern, continental breakfasts, desserts, packaged snacks, drinks) with sensible default portions.`;

const CONFIDENCE_RULES = `
CONFIDENCE & CONFIRMATION (never fake precision):
- Per-item "confidence" from 0 to 1: ≈0.9 when the food and amount are clear, ≈0.6 when you assumed a typical portion,
  ≤0.4 when you had to guess the dish itself. Overall "confidence" reflects the whole meal.
- When something that materially changes the estimate is unclear (hidden oil or ghee, homemade vs restaurant, portion size,
  which dish it is), keep your best estimate AND end "notes" with ONE short, friendly question asking the user to confirm,
  e.g. "Was the chole restaurant-style or homemade? That changes the oil estimate by ~120 kcal."
- Keep "notes" to at most two short sentences. No lectures, no judgement about the food.`;

const ITEM_SHAPE = `{
      "name": string,        // the food as people call it, e.g. "Aloo paratha", "Dal tadka (restaurant)", "Masala chai"
      "is_food": boolean,    // false for anything that is not food or drink (plates, cutlery, people, packaging)
      "quantity": number,    // how many units were eaten, e.g. 2
      "unit": string,        // e.g. "roti", "katori", "plate", "half plate", "piece", "glass", "cup", "bowl", "slice", "g"
      "grams": number,       // total estimated weight eaten
      "calories": number,    // kcal for the WHOLE quantity eaten (not per unit)
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "confidence": number   // 0..1
    }`;

const TEXT_SYSTEM = `You are ÖRZA's meal-logging engine. Convert what the user says they ate — in English, Hindi (Devanagari or Roman script)
or Hinglish — into structured nutrition estimates for everything they ate or drank.

RULES:
- One item per distinct food or drink; merge duplicates. Only include foods the user actually mentioned — never invent sides or drinks.
- Ignore words that are not food (times, places, feelings, filler like "aaj maine ... khaya").
- If no quantity is given, assume one typical serving (Indian home serving for Indian dishes) and lower that item's confidence.
- Use the profile hints only to resolve ambiguity (e.g. "curry" for a vegetarian is most likely a vegetable curry).
- "meal_type": set only when the text clearly says which meal it was (breakfast/nashta, lunch/dopahar, dinner/raat ka khana, snack); otherwise null.
- "unmatched": short phrases that sound like food but that you cannot identify at all (they are NOT added to items). Usually empty.
- "dish_name": a short natural title for the meal, e.g. "Paratha with curd".
${FOOD_KNOWLEDGE}
${CONFIDENCE_RULES}`;

const TEXT_SHAPE = `{
  "dish_name": string,
  "items": [ ${ITEM_SHAPE} ],
  "notes": string,
  "confidence": number,
  "meal_type": "breakfast" | "lunch" | "dinner" | "snack" | null,
  "unmatched": string[]
}`;

const SCAN_SYSTEM = `You are ÖRZA's food-vision engine (Snap & Know). Identify every food and drink visible in the photo, estimate the portion
actually on the plate, and estimate its nutrition.

RULES:
- List each component separately: every katori in a thali, each curry, the rice, the rotis (count them), sides, chutneys, drinks.
- Estimate size from visual scale: plate diameter (a standard dinner plate is 26–28 cm, a thali 30–32 cm), katoris, cutlery, hands, glasses.
- Read the cooking style: oil sheen or a floating oil layer, tadka, butter or cream, deep-fried vs roasted vs steamed.
- If the user added a note (e.g. "homemade, less oil", "restaurant", "half eaten", "shared between two"), trust it for portion and cooking style.
- If the photo does not show food or drink (a person, a pet, a document, a screenshot, an empty plate), return "items": [] and say so
  kindly in "notes". Never describe or comment on people.
- "dish_name": a short natural name for the whole plate, e.g. "Chole with two bhature" or "South Indian breakfast plate".
${FOOD_KNOWLEDGE}
${CONFIDENCE_RULES}`;

const SCAN_SHAPE = `{
  "dish_name": string,
  "items": [ ${ITEM_SHAPE} ],
  "notes": string,
  "confidence": number
}`;

function profileHints(p?: Profile): string {
  const parts: string[] = [];
  if (p?.diet) parts.push(`diet: ${p.diet.replace("_", "-")}`);
  if (p?.region) parts.push(`region: ${p.region}`);
  if (p?.language) parts.push(`language: ${p.language}`);
  return parts.length ? parts.join("; ") : "none shared";
}

/* ───────────────────────────── Sanitising ───────────────────────────── */

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const NON_FOOD_NAMES = new Set([
  "plate", "thali", "steel plate", "bowl", "katori", "glass", "cup", "mug", "spoon", "fork", "knife", "cutlery", "chopsticks",
  "table", "tablecloth", "napkin", "tissue", "tray", "hand", "hands", "person", "people", "phone", "packaging", "wrapper",
  "container", "box", "bottle", "utensil", "menu", "receipt", "background", "unknown", "none", "n/a",
]);

// Drinks that are legitimately ~0 kcal — never "fill" these from the food list.
const ZERO_CAL =
  /^((a )?(glass|bottle|cup) of )?(plain |mineral |soda |sparkling |warm |cold |hot |lemon )?water$|black coffee|black tea|green tea|herbal tea|diet (coke|soda)|coke zero|sugar[- ]?free/i;

/** Parse "120", 120, "120 kcal", "1,200" → number (NaN when absent). */
function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v.replace(/,/g, "").trim());
  return NaN;
}

function bounded(v: unknown, max: number, digits = 1): number {
  const n = toNum(v);
  return Number.isFinite(n) ? clamp(round(n, digits), 0, max) : 0;
}

function toConfidence(v: unknown, fallback: number): number {
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s.startsWith("high")) return 0.85;
    if (s.startsWith("med")) return 0.6;
    if (s.startsWith("low")) return 0.35;
  }
  let n = toNum(v);
  if (!Number.isFinite(n)) return fallback;
  if (n > 1) n = n / 100; // "86" → 0.86
  return clamp(round(n, 2), 0, 1);
}

function toText(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function toMealType(v: unknown): MealType | undefined {
  const s = typeof v === "string" ? v.toLowerCase().trim() : "";
  if (s === "snacks") return "snack";
  return (MEAL_TYPES as string[]).includes(s) ? (s as MealType) : undefined;
}

function toStringList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    const s = toText(x, maxLen);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Best-effort DB lookup; the nutrition module may be mid-build, so never let it throw. */
function lookup(name: string) {
  try {
    return findFood(name);
  } catch {
    return null;
  }
}

/** Fill obviously missing numbers (0 kcal, or kcal without macros) from macros or the built-in food list. */
function fillGaps(item: MealItem): MealItem {
  const macroKcal = item.protein_g * 4 + item.carbs_g * 4 + item.fat_g * 9;
  const macrosMissing = item.protein_g + item.carbs_g + item.fat_g === 0;
  if (item.calories === 0 && macroKcal > 0) return { ...item, calories: Math.round(macroKcal) };
  if (ZERO_CAL.test(item.name) || (item.calories > 0 && !macrosMissing)) return item;

  const food = lookup(item.name);
  if (!food) return item;
  let servings = 1;
  if (food.serving.unit.toLowerCase() === item.unit.toLowerCase()) servings = item.quantity;
  else if (item.grams && food.serving.grams > 0) servings = item.grams / food.serving.grams;
  let ref;
  try {
    ref = nutrientsFor(food, clamp(servings, 0.1, maxServingsFor(food)));
  } catch {
    return item;
  }
  if (!ref || ref.calories <= 0) return item;
  if (item.calories === 0) {
    return { ...item, calories: ref.calories, protein_g: ref.protein_g, carbs_g: ref.carbs_g, fat_g: ref.fat_g, fiber_g: ref.fiber_g };
  }
  // Calories known, macros missing → borrow the food's macro profile, scaled to the AI's calories.
  const k = item.calories / ref.calories;
  return {
    ...item,
    protein_g: round(ref.protein_g * k, 1),
    carbs_g: round(ref.carbs_g * k, 1),
    fat_g: round(ref.fat_g * k, 1),
    fiber_g: item.fiber_g || round(ref.fiber_g * k, 1),
  };
}

function sanitiseItems(raw: unknown): MealItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MealItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (o.is_food === false || o.is_food === "false") continue;
    const name = toText(o.name, 80);
    if (!name || NON_FOOD_NAMES.has(name.toLowerCase())) continue;
    const quantity = bounded(o.quantity, 50, 2) || 1;
    const item = cleanItem({
      name,
      quantity,
      unit: toText(o.unit, 24) || "serving",
      grams: Number.isFinite(toNum(o.grams)) && toNum(o.grams) > 0 ? bounded(o.grams, 3000, 0) : undefined,
      calories: bounded(o.calories, 4000, 0),
      protein_g: bounded(o.protein_g, 300),
      carbs_g: bounded(o.carbs_g, 600),
      fat_g: bounded(o.fat_g, 300),
      fiber_g: bounded(o.fiber_g, 100),
      confidence: toConfidence(o.confidence, 0.6),
    });
    // Filled-in macros are scaled from the food list, so re-check them against the item limits.
    out.push(clampToItemLimits(fillGaps(item)));
    if (out.length >= MAX_AI_ITEMS) break;
  }
  return out;
}

function sanitiseResult(raw: unknown): MealAIResult {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = sanitiseItems(o.items);
  const avg = items.length ? items.reduce((s, i) => s + (i.confidence ?? 0.6), 0) / items.length : 0;
  return {
    dish_name:
      toText(o.dish_name, 80) ||
      items
        .slice(0, 3)
        .map((i) => i.name)
        .join(", ") ||
      "Your meal",
    items,
    notes: toText(o.notes, 400),
    confidence: items.length ? toConfidence(o.confidence, round(avg, 2)) : 0,
  };
}

/* ───────────────────────────── Public API ───────────────────────────── */

/** Parse a typed or spoken meal description with AI. Throws HttpError (502/503/504) on AI failure. */
export async function aiParseMealText(text: string, profile?: Profile): Promise<MealTextAIResult> {
  const raw = await aiJSON<Record<string, unknown>>({
    system: TEXT_SYSTEM,
    prompt:
      `Profile hints — ${profileHints(profile)}\n\n` +
      `What the user ate (verbatim; English, Hindi or Hinglish):\n"""${text.slice(0, 500)}"""`,
    shape: TEXT_SHAPE,
    temperature: 0.1,
    maxTokens: 1400,
  });
  const base = sanitiseResult(raw);
  return { ...base, meal_type: toMealType(raw?.meal_type), unmatched: toStringList(raw?.unmatched, 10, 60) };
}

/** Recognise a meal photo (data URL) with AI. Throws HttpError (502/503/504) on AI failure. */
export async function aiScanImage(dataUrl: string, note: string | undefined, profile?: Profile): Promise<MealAIResult> {
  const cleanNote = note ? note.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  const raw = await aiJSON<Record<string, unknown>>({
    system: SCAN_SYSTEM,
    prompt:
      `Profile hints — ${profileHints(profile)}\n` +
      (cleanNote ? `User's note about this photo: """${cleanNote}"""\n` : "No note from the user.\n") +
      `Identify the food in this photo and estimate its nutrition.`,
    shape: SCAN_SHAPE,
    imageUrl: dataUrl,
    temperature: 0.1,
    maxTokens: 1600,
  });
  return sanitiseResult(raw);
}
