/**
 * ÖRZA coach — the brain behind "Ask ÖRZA".
 *
 * - buildContext():     what ÖRZA knows about the user for a day (profile, targets, meals, totals, memory).
 * - detectMealIntent(): "maine … khaya", "I had/ate/drank …", "log …", "my lunch was …" (en / hi / Hinglish).
 * - ruleBasedReply():   the deterministic, no-API-key coach. Logs meals via parseMealText + createMeal,
 *                       suggests foods from FOODS, reports progress, handles special meals and medical questions.
 * - AI helpers:         system prompt, reply shape and output normalisation for the OpenAI path.
 */
import { createMeal, dayTotals, guessMealType, listMeals, sumNutrients } from "@/lib/domain/meals";
import { getTrackingDay, setTracking } from "@/lib/domain/tracking";
import { DEFAULT_TARGETS } from "@/lib/domain/targets";
import { FOODS, findFood, nutrientsFor, parseMealText, type FoodDiet, type FoodEntry } from "@/lib/nutrition";
import { DEFAULT_TZ, addDays, dateInTz, hourInTz, isISODate, weekdayShort } from "@/lib/dates";
import { formatNumber, round } from "@/lib/utils";
import type { ChatMessage, Diet, Meal, MealItem, MealType, Nutrients, Profile, PublicUser, Targets } from "@/lib/types";

/**
 * A stored chat message. Extends ChatMessage.meta with `remembered` — the durable facts
 * ÖRZA learned from that turn, so the UI can show "Remembered: …" when history reloads.
 */
export type ChatMessageRecord = Omit<ChatMessage, "meta"> & {
  meta?: NonNullable<ChatMessage["meta"]> & { remembered?: string[] };
};

/* ───────────────────────────── Context ───────────────────────────── */

/** Fields the coach needs — satisfied by both `User` and `PublicUser`. */
export type CoachUser = Pick<PublicUser, "id" | "name" | "profile" | "targets" | "memory" | "preferences">;

export interface CoachContext {
  date: string;
  tz: string;
  hour: number;
  firstName: string;
  profile: Profile;
  profileSummary: string;
  targets: Targets;
  totals: Nutrients;
  /** targets − totals (negative = over target). */
  remaining: Nutrients;
  meals: Meal[];
  tracking: { water_glasses: number; steps: number; weight_kg?: number };
  memory: string[];
  tone: "gentle" | "direct";
}

const GOAL_LABEL = { lose: "lose weight", maintain: "maintain weight", gain: "gain weight" } as const;
const DIET_LABEL: Record<Diet, string> = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  eggetarian: "eggetarian",
  non_vegetarian: "non-vegetarian",
  jain: "Jain (no onion, garlic or root vegetables)",
};

export function profileSummary(p: Profile = {}): string {
  const parts: string[] = [];
  if (p.age) parts.push(`${p.age} years`);
  if (p.sex) parts.push(p.sex);
  if (p.height_cm) parts.push(`${p.height_cm} cm`);
  if (p.weight_kg) parts.push(`${p.weight_kg} kg`);
  if (p.goal) {
    const tw = p.target_weight_kg && p.goal !== "maintain" ? ` (target ${p.target_weight_kg} kg)` : "";
    parts.push(`goal: ${GOAL_LABEL[p.goal]}${tw}`);
  }
  if (p.activity_level) parts.push(`activity: ${p.activity_level.replace("_", " ")}`);
  if (p.diet) parts.push(`diet: ${DIET_LABEL[p.diet]}`);
  if (p.allergies?.length) parts.push(`allergies / avoids: ${p.allergies.join(", ")}`);
  if (p.conditions?.length) parts.push(`health notes they chose to share: ${p.conditions.join(", ")}`);
  if (p.region) parts.push(`region: ${p.region}`);
  if (p.language) parts.push(`language: ${p.language}`);
  if (p.household_mode) parts.push(`household: ${p.household_mode}`);
  if (p.lifestyle) parts.push(`lifestyle: ${p.lifestyle}`);
  return parts.join("; ");
}

/** Everything ÖRZA knows about the user's day. `date` defaults to "today" in the user's timezone. */
export async function buildContext(user: CoachUser, date?: string): Promise<CoachContext> {
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const day = isISODate(date) ? date : dateInTz(tz);
  const [meals, tracking] = await Promise.all([listMeals(user.id, day), getTrackingDay(user.id, day)]);
  const totals = sumNutrients(meals.map((m) => m.totals));
  const targets: Targets = { ...DEFAULT_TARGETS, ...(user.targets || {}) };
  return {
    date: day,
    tz,
    hour: hourInTz(tz),
    firstName: (user.name || "").trim().split(/\s+/)[0] || "",
    profile: user.profile || {},
    profileSummary: profileSummary(user.profile),
    targets,
    totals,
    remaining: {
      calories: Math.round(targets.calories - totals.calories),
      protein_g: round(targets.protein_g - totals.protein_g, 1),
      carbs_g: round(targets.carbs_g - totals.carbs_g, 1),
      fat_g: round(targets.fat_g - totals.fat_g, 1),
      fiber_g: round(targets.fiber_g - totals.fiber_g, 1),
    },
    meals,
    tracking: { water_glasses: tracking.water_glasses || 0, steps: tracking.steps || 0, weight_kg: tracking.weight_kg },
    memory: Array.isArray(user.memory) ? user.memory : [],
    tone: user.preferences?.tone === "direct" ? "direct" : "gentle",
  };
}

/* ───────────────────────────── Text helpers ───────────────────────────── */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const fmt = (n: number) => formatNumber(n);
const g1 = (n: number) => String(round(n, 0));

export function fmtQty(q: number): string {
  const whole = Math.floor(q);
  const frac = round(q - whole, 2);
  const f = frac === 0.5 ? "½" : frac === 0.25 ? "¼" : frac === 0.75 ? "¾" : frac ? String(round(frac, 1)).slice(1) : "";
  if (!whole && f) return f.startsWith(".") ? `0${f}` : f;
  return `${whole}${f}`;
}

const GENERIC_UNITS = new Set(["serving", "servings", "piece", "pieces", "pc", "pcs", "nos", "no", "item", "unit", ""]);

/** "2 × Paratha" or "Dal Tadka (1 katori)". */
export function itemLabel(i: Pick<MealItem, "name" | "quantity" | "unit">): string {
  const unit = (i.unit || "").trim();
  if (GENERIC_UNITS.has(unit.toLowerCase()) || unit.toLowerCase() === i.name.toLowerCase()) return `${fmtQty(i.quantity)} × ${i.name}`;
  return `${i.name} (${fmtQty(i.quantity)} ${unit})`;
}

export function mealSummary(m: Pick<Meal, "items" | "description">): string {
  return m.items.length ? m.items.map(itemLabel).join(", ") : m.description;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ───────────────────────────── Language ───────────────────────────── */

export type ReplyLang = "en" | "hinglish";

const DEVANAGARI = /[ऀ-ॿ]/;
// Words that almost never appear in English sentences.
const HINGLISH_STRONG = new Set(
  (
    "maine mene mainne humne hamne mujhe muje mujhko chahiye chahie khaya khayi khaaya khaayi piya piyi kitna kitni kitne " +
    "bacha bachi bache batao bataiye bataye kaise kaisa kaisi hai hain hoon hun nahi nahin nhi kya kyaa kyun kyu shukriya " +
    "dhanyavaad dhanyawad aaj raat subah dopahar shaam nashta naashta khana khaana khaun khau karun karu sakta sakti sakte " +
    "accha acha achha theek thik bahut bohot zyada jyada thoda thodi abhi yaar shaadi shadi dawai dawa kab kahan kaun"
  ).split(" ")
);
// Common Hindi glue words — only count in combination.
const HINGLISH_WEAK = new Set(
  "mein mai aur bhi ke ki ka ko se ek teen aadha adha liya li gaya gayi tha thi hum ji haan kuch kuchh karo kar karna wala wali paani pani kal".split(" ")
);

/** Simple heuristic: Devanagari or Hindi function words → reply in Hinglish (Roman script). */
export function detectLanguage(text: string, preferred?: Profile["language"]): ReplyLang {
  if (DEVANAGARI.test(text)) return "hinglish";
  const words = norm(text).match(/[a-z']+/g) || [];
  let strong = 0;
  let weak = 0;
  for (const w of words) {
    if (HINGLISH_STRONG.has(w)) strong++;
    else if (HINGLISH_WEAK.has(w)) weak++;
  }
  if (strong >= 1 && strong + weak >= 2) return "hinglish";
  if (strong >= 1 && words.length <= 3) return "hinglish";
  if (weak >= 3) return "hinglish";
  if ((preferred === "hinglish" || preferred === "hi") && strong + weak >= 1) return "hinglish";
  return "en";
}

/* ───────────────────────────── Intents ───────────────────────────── */

export function detectMealType(text: string): MealType | undefined {
  const t = norm(text);
  if (/\b(breakfast|brunch|nashta|naashta|nasta|subah|morning)\b/.test(t) || /सुबह|नाश्ता/.test(t)) return "breakfast";
  if (/\b(lunch|dopahar|dophar|afternoon)\b/.test(t) || /दोपहर/.test(t)) return "lunch";
  if (/\b(dinner|supper|raat|night|tonight)\b/.test(t) || /रात/.test(t)) return "dinner";
  if (/\b(snacks?|shaam|sham|evening|tea ?time|chai ?time)\b/.test(t) || /शाम/.test(t)) return "snack";
  return undefined;
}

function detectDay(t: string): "today" | "yesterday" {
  return /\b(yesterday|last night|kal)\b/.test(t) || /कल/.test(t) ? "yesterday" : "today";
}

export interface MealIntent {
  /** Text to hand to the parser (command words stripped). */
  text: string;
  explicit: boolean;
  mealType?: MealType;
  day: "today" | "yesterday";
}

const Q_START =
  /^(how|what|what's|whats|which|why|when|where|should|shall|can|could|would|will|is|are|am|do|does|did|have|has|kya|kitna|kitni|kitne|kaise|kaun|kab|kyun|kyu|kahan)\b/;
const Q_ANYWHERE = /\b(kya kha|kya pi|what should|what can|should i|can i|could i|kya main|kya mai|kya mujhe)\b/;
const EXPLICIT_LOG =
  /^(?:please\s+|pls\s+|can you\s+|could you\s+)?(?:log|track|record)\b|\b(?:log|add|note|track)\s+(?:kar|karo|kardo|kar do|karna|kr|krdo|kar dijiye|kijiye)\b|\badd\b.+\b(?:to|in)\s+(?:my\s+)?(?:log|diary|meals?|breakfast|lunch|dinner|snacks?)\b/;
const EN_ATE =
  /\b(?:i|we|i've|we've)\s+(?:(?:just|also|already|only|then|have|had|finally|actually|recently)\s+){0,2}(?:ate|eaten|drank|drunk|finished|grabbed|consumed|devoured|snacked on|had(?!\s+to\b))\b/;
const EN_START = /^(?:just\s+|also\s+)?(?:had|ate|drank|eaten)\s+(?!to\b)/;
const EN_MEAL_WAS = /\b(?:breakfast|lunch|dinner|brunch|supper|snack)\s*(?:was|today was|:|-)\s*\S/;
const HI_SUBJECT = /\b(?:maine|mene|mainne|humne|hamne|hmne)\b|मैंने|हमने/;
const HI_ATE_STRONG =
  /\b(?:khaya|khayi|khaaya|khaayi|khai|kha\s?liya|kha\s?li|kha\s?liye|khaa\s?liya|khaa\s?li|kha\s?chuka|kha\s?chuki|piya|piyi|pee\s?liya|pee\s?li|pi\s?liya|pi\s?li|pi\s?liye)\b|खाया|खायी|खाई|खा लिया|खा ली|पिया|पी ली|पी लिया/;
const HI_ATE_WEAK = /\b(?:khaye|khaaye|piye|liya|li|liye|lia)\b|खाए|लिया|ली/;
const FOOD_CUE =
  /\b(breakfast|lunch|dinner|snacks?|brunch|nashta|khana|khaana|meal|plate|katori|bowl|glass|cup|piece|slice|roti|chapati|rice|chawal|dal|daal|sabzi|paratha|ate|eaten|drank|khaya|khayi|piya)\b|खाया|खाना/;

function stripCommand(text: string) {
  return text
    .replace(/^\s*(?:please\s+|pls\s+|can you\s+|could you\s+)?(?:log|track|record|add)\s+/i, "")
    .replace(/\s+(?:to|in)\s+(?:my\s+)?(?:log|diary|meal log)\s*[.!]?\s*$/i, "")
    .replace(/\b(?:log|add|note|track)\s+(?:kar|karo|kardo|kar do|karna|kr|krdo|kar dijiye|kijiye)\b/gi, "")
    .trim();
}

/** Detects "I ate/had/drank …", "maine … khaya/khayi/piya", "log …", "for breakfast I …". Questions are ignored. */
export function detectMealIntent(text: string): MealIntent | null {
  const t = norm(text);
  if (!t) return null;
  const explicit = EXPLICIT_LOG.test(t);
  const question = Q_START.test(t) || (/\?\s*$/.test(t) && Q_ANYWHERE.test(t));
  if (question && !explicit) return null;
  const said =
    explicit ||
    EN_ATE.test(t) ||
    EN_START.test(t) ||
    EN_MEAL_WAS.test(t) ||
    HI_ATE_STRONG.test(t) ||
    (HI_SUBJECT.test(t) && HI_ATE_WEAK.test(t));
  if (!said) return null;
  return { text: stripCommand(text), explicit, mealType: detectMealType(t), day: detectDay(t) };
}

const EMERGENCY =
  /\b(chest pain|heart attack|can'?t breathe|cannot breathe|trouble breathing|difficulty breathing|breathless|saans nahi|fainted|fainting|unconscious|behosh|seizure|stroke|severe bleeding|bleeding heavily|suicid\w*|kill myself|end my life|self[- ]harm|hurt myself|overdose|poison(?:ed|ing)?|anaphyla\w*|throat (?:is )?swelling)\b/;
const DISORDERED =
  /\b(starv\w*|stop eating|not eat(?:ing)? anything|skip(?:ping)? all (?:my )?meals|purg\w*|make myself (?:vomit|throw up|sick)|laxatives?|eat nothing|zero calories|khana (?:band|chhod))\b/;
const MEDICAL =
  /\b(diabet\w*|blood sugar|sugar level|insulin|metformin|thyroid|pcos|pcod|blood pressure|high bp|low bp|bp high|bp low|hypertension|cholesterol|kidney|fatty liver|liver|gout|uric acid|pregnan\w*|breastfeeding|medicine|medication|tablets?|pills?|dosage|dose|prescription|dawai|dawa|symptoms?|fever|bukhar|vomit\w*|diarrh\w*|loose motions?|constipation|acidity|ulcer|migraine|dizzy|dizziness|chakkar|infection|cancer|surgery|injury|rash|pain|dard|ibs|celiac|coeliac|anaemi\w*|anemi\w*|deficiency|diagnos\w*)\b/;
const SPECIAL_MEAL =
  /\b(wedding|shaadi|shadi|reception|sangeet|party|parties|feast|buffet|festival|diwali|holi|eid|navratri|christmas|birthday|celebration|dawat|daawat|cheat ?(?:meal|day)|binge\w*|overate|over-ate|overeat\w*|ate too much|ate a lot|pigged out|zyada kha\w*|jyada kha\w*|bahut kha\w*|bohot kha\w*)\b/;
const SUGGEST =
  /\bwhat\s+(?:should|can|could|do|shall)\s+(?:i|we)\s+(?:eat|have|cook|make|order)\b|\bwhat\s+to\s+(?:eat|have|cook)\b|\b(?:suggest|suggestions?|recommend\w*|ideas?|options?)\b|\bhigh[- ]protein\b|\bprotein[- ]rich\b|\bhungry\b|\bcraving\b|\bplan my (?:day|meals?)\b|\bkya\s+(?:khau|khaun|khaoon|khaye|khayein|khana|banau|banaun|banaye|loon|lu|order)\b|\bchahi(?:ye|e)\b|\bbhook\b|\bbhukh\b/;
const LOOKUP =
  /\b(?:calories?|kcal|cals?|protein|nutrition|macros?)\s+(?:in|of|for|hai|hain|hoti)\b|\bhow\s+(?:many|much)\s+(?:calories|kcal|cals|protein)\s+(?:in|does|do|is|are|has|have)\b|\bkitni\s+(?:calories?|kcal)\s+(?:hoti|hai|hain)\b/;
const PROGRESS =
  /\bhow\s+am\s+i\s+doing\b|\bhow(?:'s| is)\s+my\s+(?:day|progress|intake)\b|\b(?:calories?|kcal)\s+(?:left|remaining|bache|bacha|baki|baaki)\b|\bhow\s+much\s+(?:is\s+)?(?:left|remaining)\b|\b(?:progress|summary|status|so far|my totals?|my day|on track)\b|\bhow many calories (?:have i|did i)\b|\bdid i (?:eat|hit|reach|meet)\b|\bam i (?:on track|over|under)\b|\bkitn[aie]\s+(?:bacha|bachi|bache|hua|hui|ho gaya|khaya|baki|baaki)\b|\bkaisa\s+(?:chal|ja)\s+raha\b|\baaj\s+ka\s+(?:hisaab|hisab|status|summary)\b/;
const GREETING =
  /^(?:hi+|hello+|hey+|hiya|yo|namaste|namaskar|good (?:morning|afternoon|evening)|gm|kaise ho|kya haal(?: hai)?|hola|sup)\b/;
const THANKS = /\b(thanks?|thank you|thx|ty|shukriya|dhanyavaad|dhanyawad|great|awesome|cool|okay|ok|nice|perfect|got it|theek hai|thik hai)\b/;
const WATER = /\b(water|paani|pani)\b|पानी/;
const RECIPE = /\b(recipes?|cook|banane|banau|banaun|kaise banaye|kaise banate)\b/;
const SCAN = /\b(photo|picture|pic|scan|snap|camera|image)\b/;
const GOAL = /\b(weight|vajan|wajan|goal|target weight|bmi|lose|gain)\b/;
const ACTIVITY = /\b(steps?|walk\w*|exercise|workout|activity|gym|yoga|chalna)\b/;
const SLEEP = /\b(sleep\w*|neend|insomnia|tired|thakan)\b/;
const PLAN =
  /\bplan\s+(?:my|the|for|today'?s?|mera|aaj)\b[\w\s']{0,20}\b(?:day|meals?|today|eating|food|din|khana)\b|\b(?:day|meal|diet|food|khane ka)\s+plan\b|\baaj\s+ka\s+plan\b|\bplan\s+(?:bana|banao|banaiye|banado|kar do|karo)\b/;
const REBALANCE = /\b(rebalanc\w*|compensat\w*|balance (?:it|this|things) out|make up for)\b/;
// Food words that keep sleep / activity questions on the food-suggestion path ("what to eat after my workout?").
const FOODISH = /\b(eat|eating|food|khana|khaana|khau|khaun|meal|snacks?|breakfast|lunch|dinner|protein|calories?|kcal|diet)\b/;

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, a: 1, an: 1,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, half: 0.5, aadha: 0.5, adha: 0.5,
};

/** Glasses of water in "I drank 2 glasses of water", "maine 3 glass paani piya", "1 litre water". */
function waterGlasses(t: string): number {
  const num = "(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|a|an|ek|do|teen|char|chaar|paanch|panch|chhe|saat|aath|half|aadha|adha)";
  const toN = (s: string) => (/^\d/.test(s) ? parseFloat(s) : WORD_NUM[s] ?? 1);
  let m = t.match(new RegExp(`\\b${num}\\s*(?:glass(?:es)?|gilaas|cups?)\\b`));
  if (m) return toN(m[1]);
  m = t.match(new RegExp(`\\b${num}\\s*(?:bottles?)\\b`));
  if (m) return toN(m[1]) * 4;
  m = t.match(new RegExp(`\\b${num}\\s*(?:l|litres?|liters?|ltrs?)\\b`));
  if (m) return toN(m[1]) * 4;
  m = t.match(/\b(\d{2,4})\s*ml\b/);
  if (m) return Math.max(1, Math.round(parseInt(m[1], 10) / 250));
  return 1;
}

/* ───────────────────────────── Durable facts ───────────────────────────── */

const FACT_STOP = /^(much|a lot|anything|enough|properly|well|on time|after|before|late|early|outside|out|that|this|it|much at night)\b/;

function factObject(s: string) {
  const cut = s.split(/\s+(?:and i|but|so|because|since|,? which)\b|[.!?;]/)[0].trim();
  return cut.replace(/\s+/g, " ").slice(0, 40).replace(/[ ,&-]+$/, "");
}

/** Durable personal facts stated plainly ("I'm vegetarian", "I'm allergic to peanuts", "mujhe dudh se allergy hai"). */
export function extractFacts(text: string): string[] {
  const t = norm(text);
  const out: string[] = [];
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\bi(?:'m| am)\s+(?:a\s+)?(?:pure\s+|strict\s+)?(vegetarian|vegan|eggetarian|jain|non[- ]?veg(?:etarian)?)\b/)))
    out.push(`Is ${m[1].startsWith("non") ? "non-vegetarian" : m[1]}`);
  if ((m = t.match(/\b(?:main|mai|mein)\s+(vegetarian|vegan|jain|eggetarian|non[- ]?veg)\s+(?:hoon|hu|hun)\b/)))
    out.push(`Is ${m[1].startsWith("non") ? "non-vegetarian" : m[1]}`);
  if ((m = t.match(/\bi(?:'m| am)\s+(?:severely\s+|mildly\s+|very\s+)?allergic\s+to\s+([a-z][a-z ,&-]{1,60})/))) {
    const o = factObject(m[1]);
    if (o && !FACT_STOP.test(o)) out.push(`Allergic to ${o}`);
  }
  if ((m = t.match(/\bmujhe\s+([a-z][a-z ]{1,30}?)\s+se\s+allergy\b/))) out.push(`Allergic to ${factObject(m[1])}`);
  if ((m = t.match(/\bi(?:'m| am)\s+(lactose intolerant|gluten intolerant)\b/))) out.push(`Is ${m[1]}`);
  if ((m = t.match(/\bi\s+(?:don't|do not|never|can't|cannot)\s+eat\s+([a-z][a-z ,&-]{1,60})/))) {
    const o = factObject(m[1]);
    if (o && !FACT_STOP.test(o)) out.push(`Doesn't eat ${o}`);
  }
  if ((m = t.match(/\bi\s+(?:hate|dislike|don't like|do not like)\s+([a-z][a-z ,&-]{1,60})/))) {
    const o = factObject(m[1]);
    if (o && !FACT_STOP.test(o)) out.push(`Dislikes ${o}`);
  }
  if (/\bnight shifts?\b/.test(t) && /\b(i|main|mai|my)\b/.test(t)) out.push("Works night shifts");
  return Array.from(new Set(out)).slice(0, 3);
}

/** Merge new facts into memory: trimmed, case-insensitive dedupe, newest kept, capped. */
export function mergeMemory(existing: string[] = [], add: string[] = [], cap = 30): string[] {
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim();
  const out = existing.filter((s) => typeof s === "string" && s.trim());
  const seen = new Set(out.map(key));
  for (const raw of add) {
    if (typeof raw !== "string") continue;
    const f = raw.replace(/\s+/g, " ").trim().replace(/[.。]+$/, "").slice(0, 140);
    const k = key(f);
    if (f.length < 3 || !k || seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.slice(-cap);
}

/** Session title from the first message (≤ 60 chars, cut on a word boundary). */
export function chatTitle(message: string): string {
  const s = message.replace(/\s+/g, " ").trim();
  if (!s) return "New chat";
  if (s.length <= 60) return s;
  const cut = s.slice(0, 59);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 30 ? cut.slice(0, sp) : cut).replace(/[\s,.;:!?-]+$/, "")}…`;
}

/* ───────────────────────────── Food suggestions ───────────────────────────── */

const DIET_ALLOWED: Record<Diet, FoodDiet[]> = {
  vegetarian: ["veg", "vegan"],
  vegan: ["vegan"],
  eggetarian: ["veg", "vegan", "egg"],
  non_vegetarian: ["veg", "vegan", "egg", "nonveg"],
  jain: ["veg", "vegan"],
};
const JAIN_EXCLUDE =
  /\b(onion|pyaz|pyaaz|garlic|lahsun|lehsun|potato|aloo|alu|carrot|gajar|beetroot|radish|mooli|ginger|adrak|sweet potato|shakarkand|arbi|yam)\b/;

const DAIRY = ["milk", "paneer", "dahi", "curd", "ghee", "cheese", "butter", "lassi", "raita", "khoya", "cream", "yogurt", "chaas", "buttermilk", "kheer", "malai"];
const GLUTEN = ["roti", "chapati", "paratha", "naan", "bread", "pasta", "wheat", "atta", "maida", "puri", "kulcha", "bhatura", "biscuit", "pizza", "noodles", "samosa", "upma", "daliya", "sooji", "semolina", "rava"];
const ALLERGY_MAP: Record<string, string[]> = {
  dairy: DAIRY, milk: DAIRY, lactose: DAIRY, "lactose intolerant": DAIRY, dudh: DAIRY, doodh: DAIRY,
  gluten: GLUTEN, wheat: GLUTEN, "gluten intolerant": GLUTEN,
  nuts: ["almond", "badam", "cashew", "kaju", "walnut", "akhrot", "pista", "pistachio", "nut"],
  "tree nuts": ["almond", "badam", "cashew", "kaju", "walnut", "akhrot", "pista", "pistachio"],
  peanut: ["peanut", "moongphali", "mungfali", "groundnut", "chikki"],
  peanuts: ["peanut", "moongphali", "mungfali", "groundnut", "chikki"],
  egg: ["egg", "anda", "omelette", "omelet"], eggs: ["egg", "anda", "omelette", "omelet"],
  soy: ["soy", "soya", "tofu", "edamame"], soya: ["soy", "soya", "tofu", "edamame"],
  shellfish: ["prawn", "shrimp", "crab", "lobster", "jhinga"], prawn: ["prawn", "shrimp", "jhinga"],
  seafood: ["prawn", "shrimp", "crab", "lobster", "jhinga", "fish", "machli", "machhli"],
  fish: ["fish", "machli", "machhli"],
};

function blockedTerms(ctx: CoachContext): string[] {
  const raw = [...(ctx.profile.allergies || [])];
  for (const f of ctx.memory) {
    const m = f.match(/^(?:allergic to|doesn't eat|does not eat|avoids)\s+(.+)$/i);
    if (m) raw.push(...m[1].split(/,|\band\b|&/));
  }
  const terms = new Set<string>();
  for (const r of raw) {
    const a = r.toLowerCase().trim();
    if (a.length < 3) continue;
    terms.add(a);
    for (const x of ALLERGY_MAP[a] || []) terms.add(x);
  }
  return Array.from(terms);
}

const foodText = (f: FoodEntry) => [f.name, f.key.replace(/_/g, " "), ...(f.aliases || [])].join(" ").toLowerCase();

function foodAllowed(f: FoodEntry, diet: Diet | undefined, blocked: string[]) {
  if (diet && !DIET_ALLOWED[diet].includes(f.diet)) return false;
  const text = foodText(f);
  if (diet === "jain" && JAIN_EXCLUDE.test(text)) return false;
  return !blocked.some((b) => text.includes(b));
}

const EXCLUDE_CATS: Record<MealType, string[]> = {
  breakfast: ["drink", "beverage", "sweet", "dessert", "condiment", "chutney", "pickle", "sauce", "oil", "fat", "meat"],
  lunch: ["drink", "beverage", "sweet", "dessert", "condiment", "chutney", "pickle", "sauce", "oil", "fat", "bread", "fruit"],
  dinner: ["drink", "beverage", "sweet", "dessert", "condiment", "chutney", "pickle", "sauce", "oil", "fat", "bread", "fruit"],
  snack: ["condiment", "chutney", "pickle", "sauce", "oil", "fat", "bread", "rice", "meat"],
};
const STAPLE_NAME = /^(?:plain |steamed |white |brown |jeera )?(?:rice|chawal|roti|chapati|phulka|naan|bread)$/i;
const PAIRABLE = /dal|sabzi|sabji|curry|gravy|meat|chicken|fish|paneer|egg|legume|pulse|veg/i;

interface Suggestion {
  food: FoodEntry;
  pair?: { food: FoodEntry; qty: number };
  totals: Nutrients;
}

function addN(a: Nutrients, b: Nutrients): Nutrients {
  return sumNutrients([a, b]);
}

/** Rough share of the day's calories per meal slot. */
const SLOT_SHARE: Record<MealType, number> = { breakfast: 0.27, lunch: 0.35, dinner: 0.32, snack: 0.14 };

function suggestFoods(ctx: CoachContext, mealType: MealType, wantProtein: boolean, wantSweet: boolean) {
  const share = SLOT_SHARE[mealType];
  const slotCap = Math.round(ctx.targets.calories * share * 1.15);
  const light = ctx.remaining.calories < 200;
  const budget = light ? 220 : Math.max(200, Math.min(ctx.remaining.calories, slotCap));
  const proteinGap = Math.max(0, ctx.remaining.protein_g);
  const blocked = blockedTerms(ctx);
  const exclude = EXCLUDE_CATS[mealType].filter((c) => !(wantSweet && (c === "sweet" || c === "dessert")));
  const pool = FOODS.filter(
    (f) =>
      f.per_serving?.calories > 0 &&
      !STAPLE_NAME.test(f.name.trim()) &&
      !exclude.some((c) => (f.category || "").toLowerCase().includes(c)) &&
      foodAllowed(f, ctx.profile.diet, blocked)
  );
  const rotiCandidate = findFood("roti");
  const staple = rotiCandidate && foodAllowed(rotiCandidate, ctx.profile.diet, blocked) ? rotiCandidate : null;
  const region = (ctx.profile.region || "").toLowerCase();

  const scored = pool
    .map((f) => {
      let totals: Nutrients = { ...f.per_serving };
      let pair: Suggestion["pair"];
      if (!light && staple && (mealType === "lunch" || mealType === "dinner") && PAIRABLE.test(f.category || "")) {
        for (const q of [2, 1]) {
          const t = addN(f.per_serving, nutrientsFor(staple, q));
          if (t.calories <= budget) {
            pair = { food: staple, qty: q };
            totals = t;
            break;
          }
        }
      }
      const cal = Math.max(1, totals.calories);
      const density = (totals.protein_g * 4) / cal;
      const target = light ? 150 : budget * 0.75;
      const fit = 1 - Math.min(1, Math.abs(cal - target) / Math.max(budget, 1));
      let score = wantProtein
        ? totals.protein_g * 2.2 + density * 60 + fit * 8
        : totals.protein_g * 1 + totals.fiber_g * 1.5 + density * 25 + fit * 18;
      if (!wantProtein && proteinGap > 25) score += totals.protein_g * 0.8;
      if (region && f.region && f.region.toLowerCase().includes(region)) score += 4;
      score += (hash(`${ctx.date}:${f.key}`) % 400) / 100; // gentle day-to-day variety
      return { s: { food: f, pair, totals } as Suggestion, score, fits: cal <= budget * 1.05 };
    })
    .sort((a, b) => b.score - a.score);

  let ranked = scored.filter((x) => x.fits);
  if (!ranked.length) ranked = [...scored].sort((a, b) => a.s.totals.calories - b.s.totals.calories);

  const picks: Suggestion[] = [];
  const cats = new Set<string>();
  for (const x of ranked) {
    if (picks.length === 3) break;
    const c = (x.s.food.category || "").toLowerCase();
    if (cats.has(c)) continue;
    cats.add(c);
    picks.push(x.s);
  }
  for (const x of ranked) {
    if (picks.length === 3) break;
    if (!picks.includes(x.s)) picks.push(x.s);
  }
  return { picks, light, budget };
}

function staticIdeas(diet: Diet | undefined, light: boolean): string[] {
  if (light) return ["A bowl of clear vegetable soup", "Roasted chana — a small handful", "Cucumber-tomato salad with lemon"];
  switch (diet) {
    case "vegan":
      return ["Tofu bhurji with 1 roti", "Rajma or chana with a small katori of rice", "Sprouts chaat with lemon"];
    case "jain":
      return ["Paneer tikka (no onion-garlic) with 1 roti", "Moong dal chilla with curd", "Lauki chana dal with 1 roti"];
    case "eggetarian":
      return ["Egg bhurji with 1–2 rotis", "Boiled eggs with sautéed veggies", "Dal with a small katori of rice and curd"];
    case "non_vegetarian":
      return ["Grilled or tandoori chicken with salad", "Egg bhurji with 1 roti", "Fish curry with a small katori of rice"];
    default:
      return ["Paneer bhurji with 1–2 rotis", "Moong dal chilla with curd", "Chana salad with cucumber, onion and lemon"];
  }
}

function suggestionLine(s: Suggestion): string {
  const pair = s.pair ? ` + ${fmtQty(s.pair.qty)} ${s.pair.food.name.toLowerCase()}` : "";
  // Labels already look like "1 katori (150 g)", so no extra brackets around them.
  const serving = s.food.serving?.label ? `, ${s.food.serving.label}` : "";
  return `- **${s.food.name}**${serving}${pair} — ~${fmt(s.totals.calories)} kcal · ${g1(s.totals.protein_g)} g protein`;
}

/* ───────────────────────────── Reply builders ───────────────────────────── */

export interface CoachReply {
  reply: string;
  meal: Meal | null;
  memory_add: string[];
  intent: string;
}

const MEAL_LABEL: Record<MealType, string> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snack: "snack" };

function remainingLine(lang: ReplyLang, remaining: number, target: number, totals: number) {
  if (remaining >= 0) {
    return lang === "hinglish"
      ? `Aaj ab tak **${fmt(totals)} / ${fmt(target)} kcal** — lagbhag **${fmt(remaining)} kcal** bache hain.`
      : `Today so far: **${fmt(totals)} / ${fmt(target)} kcal** — about **${fmt(remaining)} kcal** left.`;
  }
  return lang === "hinglish"
    ? `Aaj ab tak **${fmt(totals)} / ${fmt(target)} kcal** — target se lagbhag **${fmt(-remaining)} kcal** upar. Koi baat nahi, ek din se progress nahi bigadti — agla meal thoda halka rakh lijiye.`
    : `Today so far: **${fmt(totals)} / ${fmt(target)} kcal** — about **${fmt(-remaining)} kcal** over. That's completely okay; one day doesn't undo your progress. A lighter next meal or a short walk evens it out.`;
}

function medicalNote(lang: ReplyLang) {
  return lang === "hinglish"
    ? "Health condition ya dawai se judi baaton ke liye apne doctor se zaroor salah lijiye — main sirf general wellness guidance de sakta hoon."
    : "For anything about a health condition or medicines, please check with your doctor — I can only offer general wellness guidance.";
}

async function logMealReply(user: CoachUser, ctx: CoachContext, intent: MealIntent, text: string, lang: ReplyLang): Promise<CoachReply | null> {
  const parsed = parseMealText(intent.text || text);
  if (!parsed.items.length) return null;
  const date = intent.day === "yesterday" ? addDays(ctx.date, -1) : ctx.date;
  const mealType = parsed.mealType || intent.mealType || guessMealType(ctx.tz);
  const meal = await createMeal({
    userId: user.id,
    date,
    mealType,
    source: "chat",
    description: text.trim(),
    items: parsed.items,
    notes: parsed.restaurant ? "Restaurant-style portions" : undefined,
  });
  const after = date === ctx.date ? addN(ctx.totals, meal.totals) : await dayTotals(user.id, date);
  const remaining = Math.round(ctx.targets.calories - after.calories);
  const hi = lang === "hinglish";
  const lines: string[] = [];
  const when = date === ctx.date ? "" : hi ? " (kal ke liye)" : " for yesterday";
  lines.push(
    hi
      ? `**${cap(MEAL_LABEL[mealType])}** log ho gaya${when} — **${fmt(meal.totals.calories)} kcal** · ${g1(meal.totals.protein_g)} g protein.`
      : `Logged your **${MEAL_LABEL[mealType]}**${when} — **${fmt(meal.totals.calories)} kcal** · ${g1(meal.totals.protein_g)} g protein.`
  );
  lines.push(...meal.items.map((i) => `- ${itemLabel(i)} — ${fmt(i.calories)} kcal`));
  lines.push("");
  if (date === ctx.date) {
    lines.push(remainingLine(lang, remaining, ctx.targets.calories, after.calories));
    const proteinLeft = Math.round(ctx.targets.protein_g - after.protein_g);
    if (remaining > 0 && proteinLeft > 20 && ctx.hour >= 14) {
      lines.push(
        hi
          ? `Protein abhi **${proteinLeft} g** baaki hai — agle meal mein dal, paneer, dahi, anda ya chicken rakhiye.`
          : `Protein still has **${proteinLeft} g** to go — dal, paneer, curd, eggs or chicken in your next meal would close the gap.`
      );
    }
  } else {
    lines.push(hi ? `Kal ka total: **${fmt(after.calories)} kcal**.` : `Yesterday's total is now **${fmt(after.calories)} kcal**.`);
  }
  if (parsed.unmatched.length) {
    const list = parsed.unmatched.slice(0, 4).join(", ");
    lines.push(
      hi
        ? `Yeh samajh nahi aaya: *${list}* — chahein toh [meal log](/dashboard/meals) mein search karke add kar dijiye.`
        : `I couldn't place: *${list}* — you can add it by search in the [meal log](/dashboard/meals).`
    );
  }
  const norm_ = norm(text);
  if (SPECIAL_MEAL.test(norm_)) {
    lines.push(
      hi
        ? "Khaas mauke ka khana enjoy kijiye — koi guilt nahi. Chahein toh [Rebalance](/dashboard/compensation) agle 2–3 din ko halka-sa balance kar dega."
        : "Special meals are part of life — no guilt. If you'd like, [Rebalance](/dashboard/compensation) can gently even things out over the next 2–3 days."
    );
  }
  if (MEDICAL.test(norm_)) lines.push(medicalNote(lang));
  return { reply: lines.join("\n"), meal, memory_add: extractFacts(text), intent: "log_meal" };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function progressReply(ctx: CoachContext, lang: ReplyLang): string {
  const { totals: t, targets: g, tracking: tr } = ctx;
  const hi = lang === "hinglish";
  const left = ctx.remaining.calories;
  const lines = [
    hi ? `Aaj ka hisaab (${weekdayShort(ctx.date)}):` : `Here's today so far (${weekdayShort(ctx.date)}):`,
    `- **${hi ? "Calories" : "Calories"}:** ${fmt(t.calories)} / ${fmt(g.calories)} kcal${left >= 0 ? (hi ? ` (${fmt(left)} bache)` : ` (${fmt(left)} left)`) : hi ? ` (${fmt(-left)} upar)` : ` (${fmt(-left)} over)`}`,
    `- **Protein:** ${g1(t.protein_g)} / ${fmt(g.protein_g)} g`,
    `- **Carbs:** ${g1(t.carbs_g)} / ${fmt(g.carbs_g)} g · **Fat:** ${g1(t.fat_g)} / ${fmt(g.fat_g)} g`,
    `- **Fibre:** ${g1(t.fiber_g)} / ${fmt(g.fiber_g)} g`,
    `- **${hi ? "Paani" : "Water"}:** ${tr.water_glasses} / ${g.water_glasses} ${hi ? "glass" : "glasses"} · **Steps:** ${fmt(tr.steps)} / ${fmt(g.steps)}`,
    "",
  ];
  const proteinPct = g.protein_g ? t.protein_g / g.protein_g : 1;
  if (!ctx.meals.length) {
    lines.push(
      hi
        ? "Aaj abhi tak kuch log nahi hua. Bas bataiye kya khaya — jaise \"maine 2 roti aur dal khayi\" — ya [Snap & Know](/dashboard/scan) se photo lijiye."
        : "Nothing logged yet today. Just tell me what you ate — e.g. \"I had 2 roti and dal\" — or snap it in [Snap & Know](/dashboard/scan)."
    );
  } else if (left < 0) {
    lines.push(
      hi
        ? "Thoda upar hain — bilkul theek hai. Ek din se progress define nahi hoti. Halka dinner aur thodi walk kaafi hai."
        : "You're a little over — that's okay. One day doesn't define progress; a lighter meal and a short walk are plenty."
    );
  } else if (proteinPct < 0.5 && ctx.hour >= 15) {
    lines.push(
      hi
        ? "Protein thoda peeche hai — dal, paneer, dahi, anda ya chicken wala meal gap bhar dega."
        : "Protein is running behind — a meal with dal, paneer, curd, eggs or chicken would close the gap."
    );
  } else if (tr.water_glasses < g.water_glasses / 2 && ctx.hour >= 14) {
    lines.push(hi ? "Sab badhiya chal raha hai — bas paani thoda aur pijiye." : "You're on track — just sip a little more water.");
  } else {
    lines.push(hi ? "Aap track par hain — aise hi steady chaliye." : "You're on track — nice and steady.");
  }
  return lines.join("\n");
}

function suggestionReply(ctx: CoachContext, text: string, lang: ReplyLang): string {
  const t = norm(text);
  const mealType = detectMealType(t) || guessMealType(ctx.tz);
  const wantProtein = /\bprotein\b/.test(t);
  const wantSweet = /\b(sweet|dessert|meetha|mithai)\b/.test(t);
  const { picks, light } = suggestFoods(ctx, mealType, wantProtein, wantSweet);
  const hi = lang === "hinglish";
  const left = ctx.remaining.calories;
  const gap = Math.round(Math.max(0, ctx.remaining.protein_g));
  const label = MEAL_LABEL[mealType];
  const lines: string[] = [];
  if (light) {
    lines.push(
      hi
        ? `Aaj ka target lagbhag pura ho gaya hai (${fmt(ctx.totals.calories)} / ${fmt(ctx.targets.calories)} kcal), toh yeh halke ${label} options try kijiye:`
        : `You're close to today's target (${fmt(ctx.totals.calories)} / ${fmt(ctx.targets.calories)} kcal), so here are some light ${label} options:`
    );
  } else {
    const proteinBit = wantProtein || gap > 25 ? (hi ? ` aur **${gap} g protein** abhi baaki hai` : `, with **${gap} g protein** still to go`) : "";
    lines.push(
      hi
        ? `Aaj aapke paas lagbhag **${fmt(left)} kcal** bache hain${proteinBit}. Yeh teen ${label} options fit baithte hain:`
        : `You have about **${fmt(left)} kcal** left today${proteinBit}. Here are three ${label} ideas that fit:`
    );
  }
  if (picks.length) lines.push(...picks.map(suggestionLine));
  else lines.push(...staticIdeas(ctx.profile.diet, light).map((s) => `- ${s}`));
  lines.push("");
  const example = picks[0]?.food.name.toLowerCase() || (hi ? "paneer bhurji aur 1 roti" : "paneer bhurji with 1 roti");
  lines.push(
    hi
      ? `Khane ke baad bas bata dijiye — jaise "maine ${example} khaya" — aur yeh log ho jayega. Poori recipe chahiye toh [Recipes](/dashboard/recipes) dekhiye.`
      : `Once you've eaten, just tell me — e.g. "I had ${example}" — and I'll log it. Want a full recipe? Try [Recipes](/dashboard/recipes).`
  );
  return lines.join("\n");
}

const SLOT_ORDER: MealType[] = ["breakfast", "lunch", "snack", "dinner"];
/** Local hour after which an un-logged slot is considered past. */
const SLOT_END: Record<MealType, number> = { breakfast: 11, lunch: 16, snack: 19, dinner: 24 };

/** "Plan my day": one idea per meal slot still ahead, splitting the remaining calories, plus water / steps nudges. */
function planReply(ctx: CoachContext, lang: ReplyLang): string {
  const hi = lang === "hinglish";
  const logged = new Set(ctx.meals.map((m) => m.meal_type));
  const open = SLOT_ORDER.filter((s) => !logged.has(s) && ctx.hour < SLOT_END[s]);
  const left = Math.max(0, ctx.remaining.calories);
  const gap = Math.round(Math.max(0, ctx.remaining.protein_g));

  if (!open.length) {
    const intro = hi
      ? "Aaj ke saare meals ho gaye — badhiya! Yeh raha din ka hisaab:"
      : "You've covered today's meals — nice work. Here's where the day stands:";
    return `${intro}\n\n${progressReply(ctx, lang)}`;
  }

  const lines: string[] = [];
  if (left < 200) {
    const next = open[0];
    const { picks } = suggestFoods(ctx, next, false, false);
    lines.push(
      hi
        ? `Aaj ka target lagbhag pura hai (${fmt(ctx.totals.calories)} / ${fmt(ctx.targets.calories)} kcal), toh baaki din halka rakhiye:`
        : `You're close to today's target (${fmt(ctx.totals.calories)} / ${fmt(ctx.targets.calories)} kcal), so keep the rest of the day light:`
    );
    lines.push(...(picks.length ? picks.map(suggestionLine) : staticIdeas(ctx.profile.diet, true).map((s) => `- ${s}`)));
  } else {
    lines.push(
      hi
        ? `Aaj ke liye ek simple plan — lagbhag **${fmt(left)} kcal**${gap ? ` aur **${gap} g protein**` : ""} baaki hai:`
        : `Here's a simple plan for the rest of today — about **${fmt(left)} kcal**${gap ? ` and **${gap} g protein**` : ""} to go:`
    );
    const shareSum = open.reduce((a, s) => a + SLOT_SHARE[s], 0);
    const used = new Set<string>();
    open.forEach((slot, idx) => {
      const budget = Math.round((left * SLOT_SHARE[slot]) / shareSum);
      const slotCtx: CoachContext = {
        ...ctx,
        remaining: { ...ctx.remaining, calories: budget, protein_g: Math.round((gap * SLOT_SHARE[slot]) / shareSum) },
      };
      const { picks } = suggestFoods(slotCtx, slot, gap > 25, false);
      const pick = picks.find((p) => !used.has(p.food.key)) || picks[0];
      const label = `**${cap(MEAL_LABEL[slot])}** (~${fmt(budget)} kcal)`;
      if (pick) {
        used.add(pick.food.key);
        const pair = pick.pair ? ` + ${fmtQty(pick.pair.qty)} ${pick.pair.food.name.toLowerCase()}` : "";
        lines.push(`- ${label}: ${pick.food.name}${pair} — ${g1(pick.totals.protein_g)} g protein`);
      } else {
        const ideas = staticIdeas(ctx.profile.diet, budget < 200);
        lines.push(`- ${label}: ${ideas[idx % ideas.length]}`);
      }
    });
  }

  const water = Math.max(0, ctx.targets.water_glasses - ctx.tracking.water_glasses);
  const steps = Math.max(0, ctx.targets.steps - ctx.tracking.steps);
  if (water) lines.push(hi ? `- **Paani:** ${water} glass aur` : `- **Water:** ${water} more ${water === 1 ? "glass" : "glasses"}`);
  if (steps) {
    lines.push(
      hi
        ? `- **Steps:** ${fmt(steps)} aur — khane ke baad 15 minute ki walk kaafi madad karti hai`
        : `- **Steps:** ${fmt(steps)} more — a 15-minute walk after a meal goes a long way`
    );
  }
  lines.push("");
  lines.push(
    hi
      ? "Jaise-jaise khayein, bas mujhe bata dijiye — main numbers update karta rahunga."
      : "Tell me what you eat as you go and I'll keep the numbers up to date."
  );
  return lines.join("\n");
}

function lookupReply(text: string, lang: ReplyLang): string | null {
  const parsed = parseMealText(text);
  if (!parsed.items.length) return null;
  const tot = sumNutrients(parsed.items);
  const hi = lang === "hinglish";
  const lines = parsed.items.map((i) => `- ${itemLabel(i)} — ${fmt(i.calories)} kcal · ${g1(i.protein_g)} g protein`);
  const head = hi
    ? `Lagbhag **${fmt(tot.calories)} kcal** · ${g1(tot.protein_g)} g protein · ${g1(tot.carbs_g)} g carbs · ${g1(tot.fat_g)} g fat:`
    : `That's about **${fmt(tot.calories)} kcal** · ${g1(tot.protein_g)} g protein · ${g1(tot.carbs_g)} g carbs · ${g1(tot.fat_g)} g fat:`;
  const tail = hi
    ? `\nKhaya hai toh bas likhiye **"log ${text.replace(/\?+$/, "").trim().slice(0, 40)}"** — main add kar dunga.`
    : `\nIf you've eaten it, just say **"log ${parsed.items.map((i) => `${fmtQty(i.quantity)} ${i.name.toLowerCase()}`).join(", ")}"** and I'll add it.`;
  return [head, ...lines, tail].join("\n");
}

function specialMealReply(lang: ReplyLang): string {
  return lang === "hinglish"
    ? [
        "Khaas mauke ka khana zindagi ka hissa hai — enjoy kijiye, koi guilt nahi. Ek bada meal aapki progress mita nahi deta.",
        "",
        "Chahein toh hum agle 2–3 din halka-sa rebalance kar sakte hain — thode halke meals, zyada protein aur fibre, thode extra steps. Na bhookha rehna, na saza.",
        "- [Rebalance](/dashboard/compensation) mein ek gentle plan banaiye",
        "- Ya bataiye kya kya khaya (jaise \"1 plate biryani, 2 gulab jamun\") — main log kar dunga",
      ].join("\n")
    : [
        "Enjoyed a special meal? No guilt — special meals are part of life. One big meal doesn't undo your progress.",
        "",
        "If you'd like, we can gently rebalance over the next 2–3 days — slightly lighter meals, more protein and fibre, a few extra steps. No starving, no punishment.",
        "- Create a gentle plan in [Rebalance](/dashboard/compensation)",
        "- Or tell me what you had (e.g. \"1 plate biryani, 2 gulab jamun\") and I'll log it",
      ].join("\n");
}

function emergencyReply(lang: ReplyLang): string {
  return lang === "hinglish"
    ? "Yeh serious lag raha hai. Kripya abhi emergency help lijiye — **112** par call kijiye ya nazdeeki hospital jaiye. Agar aap khud ko nuksaan pahunchane ka soch rahe hain, toh **Tele-MANAS 14416** (free, 24×7) par baat kijiye. Aap akele nahi hain."
    : "This sounds serious. Please get help right now — call **112** or go to the nearest hospital. If you're thinking about harming yourself, you can talk to **Tele-MANAS on 14416** (free, 24×7). You're not alone.";
}

function disorderedReply(lang: ReplyLang): string {
  return lang === "hinglish"
    ? "Main bhookha rehne ya khana chhodne ki salah kabhi nahi deta — aapka shareer poshan ka haqdaar hai. Agar khane ko lekar mann pe bojh hai, toh kisi doctor ya counsellor se baat kijiye, ya **Tele-MANAS 14416** (free, 24×7) par call kijiye. Main aapke saath chhote, gentle steps plan kar sakta hoon — jab ready hon."
    : "I'll never suggest starving or skipping food — your body deserves nourishment. If food is feeling heavy on your mind, please talk to a doctor or counsellor, or call **Tele-MANAS on 14416** (free, 24×7). Whenever you're ready, I can help you plan small, gentle steps.";
}

function medicalReply(lang: ReplyLang): string {
  return lang === "hinglish"
    ? [
        "Yeh sawaal doctor ke liye behtar hai — main diagnose nahi kar sakta, na dawai ke baare mein salah de sakta hoon. Kripya apne doctor se baat kijiye; agar takleef zyada ho toh turant **112** par call kijiye.",
        "",
        "Tab tak main khane ke portions, balanced plates aur gentle habits mein madad kar sakta hoon — jo bhi aapke doctor ki salah ke saath fit ho.",
      ].join("\n")
    : [
        "That's one for your doctor — I can't diagnose conditions or advise on medicines. Please check in with them, and if it feels urgent, call **112** right away.",
        "",
        "Meanwhile, I'm happy to help with portions, balanced plates and gentle habits that fit whatever your doctor recommends.",
      ].join("\n");
}

function greetingReply(ctx: CoachContext, lang: ReplyLang): string {
  const name = ctx.firstName ? ` ${ctx.firstName}` : "";
  const left = ctx.remaining.calories;
  if (lang === "hinglish") {
    const state = ctx.meals.length
      ? `Aaj ab tak **${fmt(ctx.totals.calories)} kcal** hua hai${left >= 0 ? ` — **${fmt(left)} kcal** bache hain` : ""}.`
      : "Aaj abhi tak kuch log nahi hua.";
    return [
      `Namaste${name}! ${state} Kya karein?`,
      "- Bataiye kya khaya — \"maine 2 roti aur dal khayi\"",
      "- Poochiye \"Dinner mein kya khaun?\"",
      "- Ya \"Aaj kitna bacha?\"",
    ].join("\n");
  }
  const state = ctx.meals.length
    ? `You've had **${fmt(ctx.totals.calories)} kcal** so far today${left >= 0 ? ` — **${fmt(left)} kcal** left` : ""}.`
    : "Nothing logged yet today.";
  return [
    `Hi${name}! ${state} What would you like to do?`,
    "- Tell me what you ate — \"I had 2 roti and dal\"",
    "- Ask \"What should I eat for dinner?\"",
    "- Or \"How am I doing today?\"",
  ].join("\n");
}

function capabilitiesReply(lang: ReplyLang): string {
  return lang === "hinglish"
    ? [
        "Main ÖRZA hoon — aapka wellness companion. Main yeh sab kar sakta hoon:",
        "- **Meal log** — chat ya voice se: \"Aaj maine breakfast mein do paratha aur dahi khaya\"",
        "- **Kya khayein** — bache hue calories ke hisaab se: \"Mujhe high protein dinner chahiye\"",
        "- **Din ka hisaab** — \"Aaj kitna bacha?\"",
        "- **Gentle rebalance** — shaadi ya party ke baad: [Rebalance](/dashboard/compensation)",
        "- **Recipes aur reports** — [Recipes](/dashboard/recipes) · [Reports](/dashboard/reports)",
      ].join("\n")
    : [
        "I'm ÖRZA, your wellness companion. Here's what I can help with:",
        "- **Log meals** by chat or voice — \"Aaj maine breakfast mein do paratha aur dahi khaya\"",
        "- **Suggest what to eat** within your remaining calories — \"Mujhe high protein dinner chahiye\"",
        "- **Check your day** — \"How am I doing today?\"",
        "- **Rebalance gently** after a wedding or party — [Rebalance](/dashboard/compensation)",
        "- **Recipes and reports** — [Recipes](/dashboard/recipes) · [Reports](/dashboard/reports)",
      ].join("\n");
}

function goalReply(ctx: CoachContext, lang: ReplyLang): string {
  const p = ctx.profile;
  const hi = lang === "hinglish";
  const goal = p.goal ? GOAL_LABEL[p.goal] : null;
  const weight = ctx.tracking.weight_kg || p.weight_kg;
  const lines: string[] = [];
  if (goal) {
    const tw = p.target_weight_kg && p.goal !== "maintain" ? ` → ${p.target_weight_kg} kg` : "";
    lines.push(
      hi
        ? `Aapka goal: **${goal}**${weight ? ` (${weight} kg${tw})` : ""}. Roz ka target **${fmt(ctx.targets.calories)} kcal** aur **${fmt(ctx.targets.protein_g)} g protein** hai.`
        : `Your goal: **${goal}**${weight ? ` (${weight} kg${tw})` : ""}. Your daily target is **${fmt(ctx.targets.calories)} kcal** with **${fmt(ctx.targets.protein_g)} g protein**.`
    );
  } else {
    lines.push(
      hi
        ? `Abhi aapka roz ka target **${fmt(ctx.targets.calories)} kcal** hai.`
        : `Your daily target is currently **${fmt(ctx.targets.calories)} kcal**.`
    );
  }
  lines.push(
    hi
      ? "Steady progress ke liye: har meal mein protein, roz thode steps, aur hafte mein ek baar weight check. [Goals](/dashboard/goals) mein apna plan update kar sakte hain."
      : "Steady wins: protein at every meal, some movement daily and a weekly weigh-in. You can update your plan any time in [Goals](/dashboard/goals)."
  );
  return lines.join("\n");
}

function activityReply(ctx: CoachContext, lang: ReplyLang): string {
  const s = ctx.tracking.steps;
  const g = ctx.targets.steps;
  return lang === "hinglish"
    ? [
        `Aaj ke steps: **${fmt(s)} / ${fmt(g)}**.`,
        "- Khane ke baad 10–15 minute ki walk — digestion aur blood sugar dono ke liye accha",
        "- Phone calls chalte-chalte lijiye",
        "- Lift ki jagah seedhiyan",
      ].join("\n")
    : [
        `Steps today: **${fmt(s)} / ${fmt(g)}**.`,
        "- A 10–15 minute walk after meals helps digestion and steadies energy",
        "- Take phone calls on your feet",
        "- Stairs over the lift when you can",
      ].join("\n");
}

function sleepReply(lang: ReplyLang): string {
  return lang === "hinglish"
    ? [
        "Achhi neend ke liye kuch gentle tips:",
        "- Raat ka khana sone se 2–3 ghante pehle",
        "- Shaam 4 baje ke baad chai-coffee kam",
        "- Roz ek hi time par sona aur uthna",
        "- Sone se pehle 30 minute screen se break",
      ].join("\n")
    : [
        "A few gentle sleep habits:",
        "- Finish dinner 2–3 hours before bed",
        "- Ease off tea and coffee after 4 pm",
        "- Keep a steady sleep and wake time",
        "- Give screens a 30-minute break before sleep",
      ].join("\n");
}

async function waterReply(user: CoachUser, ctx: CoachContext, text: string, lang: ReplyLang): Promise<string> {
  const add = Math.max(0.5, Math.min(12, waterGlasses(norm(text))));
  const total = Math.max(0, Math.min(40, round((ctx.tracking.water_glasses || 0) + add, 1)));
  await setTracking(user.id, ctx.date, { water_glasses: total });
  const goal = ctx.targets.water_glasses;
  const done = total >= goal;
  return lang === "hinglish"
    ? `**${fmtQty(add)} glass** paani add ho gaya — aaj **${fmtQty(total)} / ${goal}** glass.${done ? " Aaj ka paani ka goal pura!" : " Badhiya, aise hi sip karte rahiye."}`
    : `Added **${fmtQty(add)} ${add === 1 ? "glass" : "glasses"}** of water — **${fmtQty(total)} / ${goal}** today.${done ? " Hydration goal done for today!" : " Nice — keep sipping."}`;
}

function recipeReply(ctx: CoachContext, lang: ReplyLang): string {
  const left = fmt(Math.max(0, ctx.remaining.calories));
  return lang === "hinglish"
    ? `[Recipes](/dashboard/recipes) mein main aapke bache hue calories (${left} kcal) aur diet ke hisaab se poori recipe bana sakta hoon — ingredients, steps aur nutrition ke saath.`
    : `In [Recipes](/dashboard/recipes) I can create a full recipe that fits your remaining ${left} kcal and your diet — with ingredients, steps and nutrition per serving.`;
}

function factsReply(facts: string[], lang: ReplyLang): string {
  const list = facts.map((f) => `- ${f}`).join("\n");
  return lang === "hinglish"
    ? `Samajh gaya — yeh yaad rakhunga:\n${list}\n\nAage ke suggestions mein iska dhyaan rahega. Jo bhi main yaad rakhta hoon, woh [Settings](/dashboard/settings) mein dekh ya badal sakte hain.`
    : `Got it — I'll remember:\n${list}\n\nI'll keep this in mind for suggestions. You can review what I remember anytime in [Settings](/dashboard/settings).`;
}

/**
 * Deterministic coach used when no AI key is configured (or the AI is unavailable).
 * May log a meal (source "chat") or water as a side effect.
 */
export async function ruleBasedReply(user: CoachUser, ctx: CoachContext, text: string): Promise<CoachReply> {
  const t = norm(text);
  const lang = detectLanguage(text, ctx.profile.language);
  const facts = extractFacts(text);
  const done = (reply: string, intent: string, meal: Meal | null = null): CoachReply => ({ reply, meal, memory_add: facts, intent });

  if (EMERGENCY.test(t)) return done(emergencyReply(lang), "emergency");
  if (DISORDERED.test(t)) return done(disorderedReply(lang), "care");

  const intent = detectMealIntent(text);

  // "I drank 2 glasses of water" → hydration, not a meal (unless other foods are mentioned).
  if (WATER.test(t) && (intent || /\b(add|log|drink|drank|pee|pi)\b/.test(t))) {
    const parsed = parseMealText(text);
    const hasFood = parsed.items.some((i) => i.calories > 0 && !/water|paani|pani/i.test(i.name));
    if (!hasFood) return done(await waterReply(user, ctx, text, lang), "water");
  }

  if (intent) {
    const logged = await logMealReply(user, ctx, intent, text, lang);
    if (logged) return logged;
    if (SPECIAL_MEAL.test(t)) return done(specialMealReply(lang), "special_meal");
    if (FOOD_CUE.test(t) || intent.explicit) {
      return done(
        lang === "hinglish"
          ? 'Log karne ke liye dishes samajh nahi aayi. Portion ke saath likhiye — jaise **"2 roti, 1 katori dal aur ek plate chawal"**. Aap [meal log](/dashboard/meals) mein search karke bhi add kar sakte hain, ya [Snap & Know](/dashboard/scan) se photo le sakte hain.'
          : 'I\'d love to log that, but I couldn\'t recognise the foods. Try naming dishes with portions — e.g. **"2 roti, 1 katori dal and a plate of rice"**. You can also add it by search in the [meal log](/dashboard/meals) or snap a photo in [Snap & Know](/dashboard/scan).',
        "log_meal_unrecognised"
      );
    }
  }

  if (MEDICAL.test(t)) return done(medicalReply(lang), "medical");
  if (SPECIAL_MEAL.test(t)) return done(specialMealReply(lang), "special_meal");
  if (LOOKUP.test(t)) {
    const r = lookupReply(text, lang);
    if (r) return done(r, "lookup");
  }
  if (PLAN.test(t)) return done(planReply(ctx, lang), "plan");
  if (PROGRESS.test(t)) return done(progressReply(ctx, lang), "progress");
  if (REBALANCE.test(t)) return done(specialMealReply(lang), "special_meal");
  const foodish = FOODISH.test(t);
  if (SLEEP.test(t) && !foodish) return done(sleepReply(lang), "sleep");
  if (ACTIVITY.test(t) && !foodish && !GOAL.test(t)) return done(activityReply(ctx, lang), "activity");
  if (RECIPE.test(t) && /\brecipes?\b/.test(t)) return done(recipeReply(ctx, lang), "recipe");
  if (SUGGEST.test(t)) return done(suggestionReply(ctx, text, lang), "suggest");
  if (facts.length) return done(factsReply(facts, lang), "memory");

  const words = t.split(" ").length;
  if (GREETING.test(t) && words <= 6) return done(greetingReply(ctx, lang), "greeting");
  if (THANKS.test(t) && words <= 5) {
    return done(
      lang === "hinglish"
        ? `Koi baat nahi${ctx.firstName ? `, ${ctx.firstName}` : ""}! Jab bhi meal log karna ho ya agla plan banana ho, bas likh dijiye.`
        : `Anytime${ctx.firstName ? `, ${ctx.firstName}` : ""}! I'm here whenever you want to log a meal or plan the next one.`,
      "thanks"
    );
  }
  if (RECIPE.test(t)) return done(recipeReply(ctx, lang), "recipe");
  if (SCAN.test(t)) {
    return done(
      lang === "hinglish"
        ? "Thali ki photo lijiye [Snap & Know](/dashboard/scan) mein — main har item pehchaan kar calories aur macros bata dunga, aur aap confirm karke log kar sakte hain."
        : "Snap your plate in [Snap & Know](/dashboard/scan) — I'll recognise each item, estimate calories and macros, and you can confirm to log it.",
      "scan"
    );
  }
  if (GOAL.test(t)) return done(goalReply(ctx, lang), "goal");
  if (ACTIVITY.test(t)) return done(activityReply(ctx, lang), "activity");
  if (SLEEP.test(t)) return done(sleepReply(lang), "sleep");
  return done(capabilitiesReply(lang), "help");
}

/* ───────────────────────────── AI path ───────────────────────────── */

/** Compact description of the user's day for the AI system prompt. */
export function contextForPrompt(ctx: CoachContext): string {
  const t = ctx.targets;
  const n = ctx.totals;
  const lines = [
    `Local date: ${ctx.date} (${weekdayShort(ctx.date)}), local time about ${String(ctx.hour).padStart(2, "0")}:00 (${ctx.tz}).`,
    `User: ${ctx.firstName || "the user"}. ${ctx.profileSummary || "Profile details not filled in yet."}`,
    `Daily targets: ${t.calories} kcal · protein ${t.protein_g} g · carbs ${t.carbs_g} g · fat ${t.fat_g} g · fibre ${t.fiber_g} g · water ${t.water_glasses} glasses · steps ${t.steps}.`,
    `Eaten today: ${n.calories} kcal · protein ${n.protein_g} g · carbs ${n.carbs_g} g · fat ${n.fat_g} g · fibre ${n.fiber_g} g.`,
    `Remaining today: ${ctx.remaining.calories} kcal (negative = over target) · protein ${ctx.remaining.protein_g} g.`,
    `Water ${ctx.tracking.water_glasses}/${t.water_glasses} glasses · steps ${ctx.tracking.steps}/${t.steps}.`,
    ctx.meals.length
      ? `Meals logged today:\n${ctx.meals.map((m) => `- ${m.meal_type}: ${mealSummary(m)} (${m.totals.calories} kcal, ${m.totals.protein_g} g protein)`).join("\n")}`
      : "No meals logged yet today.",
    ctx.memory.length ? `Remembered about the user:\n${ctx.memory.map((f) => `- ${f}`).join("\n")}` : "Nothing remembered about the user yet.",
    `Preferred tone: ${ctx.tone}.`,
  ];
  return lines.join("\n");
}

export type HistoryTurn = { role: "user" | "assistant"; content: string };

export function coachSystemPrompt(ctx: CoachContext, history: HistoryTurn[]): string {
  const convo = history.length
    ? history.map((h) => `${h.role === "user" ? "User" : "ÖRZA"}: ${h.content.replace(/\s+/g, " ").slice(0, 800)}`).join("\n")
    : "(This is the start of the conversation.)";
  return [
    "You are ÖRZA (pronounced \"Urja\"), the user's warm, judgment-free AI wellness companion inside the ÖRZA app, with deep knowledge of Indian regional and global food. Talk like a caring, knowledgeable friend: short, specific and practical, using the user's real numbers below.",
    "",
    "App pages you can link to as markdown links with these relative paths: meal log /dashboard/meals · Snap & Know photo scan /dashboard/scan · Rebalance after special meals /dashboard/compensation · Goals /dashboard/goals · Recipes /dashboard/recipes · Reports /dashboard/reports · Settings /dashboard/settings.",
    "",
    "Rules:",
    "- If the user says they ate or drank something (\"maine … khaya/khayi/piya\", \"I had/ate/drank …\", \"log …\", \"for breakfast I …\"), fill log_meal: one item per food with realistic Indian home-style portions (1 roti ≈ 40 g, 1 paratha ≈ 80 g, 1 katori ≈ 150 g, 1 plate rice ≈ 200 g) unless they mention a restaurant, hotel or dhaba. Nutrients are for the quantity eaten. In reply, confirm what you logged, its total kcal and roughly how many kcal remain today after it.",
    "- Never log hypothetical, planned or future food, or questions (\"can I eat …\", \"should I have …\", \"kya khaun\"). Then log_meal is null.",
    "- meal_type comes from their words (breakfast/nashta, lunch, dinner/raat, snack), else from the local time. day is \"yesterday\" only when they clearly mean yesterday (\"kal raat\", \"last night\", \"yesterday\"), else \"today\".",
    "- Weddings, parties, festivals, cheat meals: reassure (no guilt — one meal doesn't undo progress) and offer a gentle rebalance at /dashboard/compensation.",
    "- Food suggestions must respect their diet, allergies and remaining calories; prioritise protein when they ask. Prefer familiar Indian options from their region.",
    "- Medical questions: give general wellness context only and gently suggest their doctor. Emergencies: tell them to call 112 now.",
    "- memory_add: only durable personal facts useful in future chats (diet, allergies, dislikes, health conditions they mention, schedule, household, cuisine preferences, goals). Short third-person phrases like \"Works night shifts\". Never today's meals, never facts already remembered. Usually []. Max 3.",
    "- reply format: plain text, short paragraphs, **bold** sparingly, \"- \" bullets for lists. No headings, tables or emojis. Under ~120 words unless they ask for detail.",
    "- Language: reply in the language the user wrote in — English, Hindi, or Hinglish (Roman-script Hindi-English mix).",
    "",
    "USER CONTEXT",
    contextForPrompt(ctx),
    "",
    "RECENT CONVERSATION (oldest first)",
    convo,
  ].join("\n");
}

export const COACH_REPLY_SHAPE = `{
  "reply": string,
  "log_meal": null | {
    "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
    "day": "today" | "yesterday",
    "description": string,
    "items": [{ "name": string, "quantity": number, "unit": string, "grams": number, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number }]
  },
  "memory_add": string[]
}`;

export interface AiCoachOutput {
  reply: string;
  log_meal: { meal_type: MealType; day: "today" | "yesterday"; description: string; items: Partial<MealItem>[] } | null;
  memory_add: string[];
}

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const num = (v: unknown, max: number) => Math.min(max, Math.max(0, Number(v) || 0));

/** Validates the model's JSON; returns null when there is no usable reply. */
export function normaliseAiOutput(raw: any, fallbackMealType: MealType): AiCoachOutput | null {
  const reply = typeof raw?.reply === "string" ? raw.reply.trim().slice(0, 4000) : "";
  if (!reply) return null;
  let log_meal: AiCoachOutput["log_meal"] = null;
  const lm = raw?.log_meal;
  if (lm && typeof lm === "object" && Array.isArray(lm.items)) {
    const items = lm.items
      .filter((i: any) => i && typeof i === "object" && typeof i.name === "string" && i.name.trim())
      .slice(0, 20)
      .map((i: any) => ({
        name: i.name.trim(),
        quantity: num(i.quantity, 100) || 1,
        unit: typeof i.unit === "string" && i.unit.trim() ? i.unit.trim() : "serving",
        grams: i.grams != null ? num(i.grams, 5000) : undefined,
        calories: num(i.calories, 4000),
        protein_g: num(i.protein_g, 300),
        carbs_g: num(i.carbs_g, 600),
        fat_g: num(i.fat_g, 300),
        fiber_g: num(i.fiber_g, 100),
      }));
    if (items.length) {
      log_meal = {
        meal_type: MEAL_TYPES.includes(lm.meal_type) ? lm.meal_type : fallbackMealType,
        day: lm.day === "yesterday" ? "yesterday" : "today",
        description:
          typeof lm.description === "string" && lm.description.trim() ? lm.description.trim().slice(0, 300) : items.map((i: any) => i.name).join(", "),
        items,
      };
    }
  }
  const memory_add: string[] = Array.isArray(raw?.memory_add)
    ? raw.memory_add
        .filter((s: unknown): s is string => typeof s === "string")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length >= 3 && s.length <= 140)
        .slice(0, 3)
    : [];
  return { reply, log_meal, memory_add };
}
