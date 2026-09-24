/**
 * Deterministic "ÖRZA says" one-liner for the Today screen.
 * Warm, judgment-free, diet- and allergy-aware — no AI call, so it is free and instant.
 * Every food idea is checked with src/lib/allergens.ts; when nothing safe is left the line
 * falls back to allergen-neutral wording instead of naming a dish.
 */
import { conflictsWithAllergies } from "@/lib/allergens";
import type { Diet, Nutrients, Targets } from "@/lib/types";
import { clamp, formatNumber } from "@/lib/utils";

export type InsightInput = {
  /** Viewing the user's current day (time-of-day rules apply) vs. looking back. */
  isToday: boolean;
  /** Local hour 0–23 in the user's timezone. */
  hour: number;
  mealsCount: number;
  totals: Nutrients;
  targets: Targets;
  water: number;
  diet?: Diet;
  /** Allergies and foods to avoid (see avoidList), free text. */
  allergies?: string[];
};

type DietKey = Diet | "default";

/** A food idea plus the ingredients its name doesn't spell out, so allergy checks see them too. */
type Idea = { text: string; contains: string[] };

const IDEA = {
  // protein top-ups
  dal: { text: "a katori of dal", contains: ["dal", "lentil", "lentils"] },
  moongDal: { text: "a katori of moong dal", contains: ["moong", "dal", "lentil", "lentils"] },
  chanaChaat: { text: "chana chaat", contains: ["chana", "chickpea", "chickpeas", "onion", "tomato"] },
  roastedChana: { text: "a handful of roasted chana", contains: ["chana", "chickpea", "chickpeas"] },
  sprouts: { text: "a moong sprouts salad", contains: ["moong", "sprouts", "lentil", "lentils", "onion", "tomato"] },
  tofuBhurji: { text: "tofu bhurji", contains: ["tofu", "soy", "soya", "onion", "tomato"] },
  soyaChunks: { text: "a bowl of soya chunks curry", contains: ["soya", "soy", "soya chunks", "onion", "tomato"] },
  paneerTikka: { text: "paneer tikka", contains: ["paneer", "curd", "dairy", "milk"] },
  hungCurd: { text: "a bowl of hung curd", contains: ["curd", "dahi", "milk", "dairy"] },
  boiledEggs: { text: "two boiled eggs", contains: ["egg", "eggs"] },
  grilledChicken: { text: "grilled chicken", contains: ["chicken"] },
  grilledFish: { text: "a piece of grilled fish", contains: ["fish"] },

  // breakfasts
  besanChilla: { text: "a besan chilla", contains: ["besan", "gram flour", "chickpea", "chickpeas", "chana"] },
  moongChilla: { text: "a moong dal chilla", contains: ["moong", "dal", "lentil", "lentils"] },
  pohaPeanuts: {
    text: "poha with peanuts",
    contains: ["poha", "flattened rice", "rice", "peanut", "peanuts", "onion", "mustard seeds", "rai", "curry leaves"],
  },
  curdFruit: { text: "curd with fruit", contains: ["curd", "dahi", "milk", "dairy", "fruit"] },
  idliSambar: {
    text: "idli with sambar",
    contains: ["idli", "rice", "urad", "dal", "lentil", "lentils", "sambar", "tamarind", "mustard seeds", "rai"],
  },
  dalia: { text: "a bowl of dalia", contains: ["dalia", "wheat", "gluten", "milk"] },
  eggBhurjiToast: { text: "egg bhurji with toast", contains: ["egg", "eggs", "bread", "wheat", "gluten", "butter", "onion"] },
  omelette: { text: "a masala omelette", contains: ["egg", "eggs", "omelette", "onion", "tomato"] },

  // lighter dinners
  khichdi: { text: "dal-khichdi", contains: ["dal", "lentil", "lentils", "rice", "khichdi"] },
  moongKhichdi: { text: "moong dal khichdi", contains: ["moong", "dal", "lentil", "lentils", "rice", "khichdi"] },
  veggieSoup: { text: "a veggie-loaded soup", contains: ["vegetables", "soup"] },
  laukiSabzi: { text: "a bowl of lauki sabzi", contains: ["lauki", "bottle gourd", "sabzi"] },
  chickenSoup: { text: "a clear chicken soup", contains: ["chicken", "soup"] },
  curdRice: { text: "a small bowl of curd rice", contains: ["curd", "dahi", "milk", "dairy", "rice", "mustard seeds", "rai"] },

  // balanced dinners
  dalSabziRoti: {
    text: "dal, a sabzi and two rotis",
    contains: ["dal", "lentil", "lentils", "sabzi", "roti", "wheat", "atta", "gluten"],
  },
  dalSabziRice: { text: "dal, a sabzi and a bowl of rice", contains: ["dal", "lentil", "lentils", "sabzi", "rice"] },
  rajmaRice: { text: "rajma with rice and a salad", contains: ["rajma", "kidney beans", "beans", "rice", "onion", "tomato"] },
  chickenRice: { text: "grilled chicken with a sabzi and rice", contains: ["chicken", "sabzi", "rice"] },
  paneerSabziRice: { text: "a paneer sabzi with rice", contains: ["paneer", "dairy", "milk", "sabzi", "rice"] },
} satisfies Record<string, Idea>;

type IdeaTable = Record<DietKey, Idea[]>;

/** Ideas per diet in order of preference; the first safe ones are named. Unset diet → vegetarian-safe ideas. */
const PROTEIN_IDEAS: IdeaTable = {
  vegan: [IDEA.dal, IDEA.chanaChaat, IDEA.tofuBhurji, IDEA.soyaChunks, IDEA.roastedChana, IDEA.sprouts],
  jain: [IDEA.moongDal, IDEA.paneerTikka, IDEA.hungCurd, IDEA.roastedChana],
  vegetarian: [IDEA.dal, IDEA.paneerTikka, IDEA.hungCurd, IDEA.chanaChaat, IDEA.roastedChana, IDEA.tofuBhurji],
  eggetarian: [IDEA.dal, IDEA.paneerTikka, IDEA.boiledEggs, IDEA.hungCurd, IDEA.chanaChaat, IDEA.roastedChana],
  non_vegetarian: [IDEA.dal, IDEA.grilledChicken, IDEA.boiledEggs, IDEA.grilledFish, IDEA.chanaChaat, IDEA.roastedChana],
  default: [IDEA.dal, IDEA.paneerTikka, IDEA.chanaChaat, IDEA.roastedChana, IDEA.sprouts],
};

const BREAKFAST_IDEAS: IdeaTable = {
  vegan: [IDEA.pohaPeanuts, IDEA.besanChilla, IDEA.moongChilla, IDEA.idliSambar],
  jain: [IDEA.moongChilla, IDEA.dalia, IDEA.besanChilla],
  vegetarian: [IDEA.besanChilla, IDEA.pohaPeanuts, IDEA.curdFruit, IDEA.moongChilla, IDEA.idliSambar],
  eggetarian: [IDEA.besanChilla, IDEA.eggBhurjiToast, IDEA.moongChilla, IDEA.omelette, IDEA.idliSambar],
  non_vegetarian: [IDEA.besanChilla, IDEA.eggBhurjiToast, IDEA.moongChilla, IDEA.omelette, IDEA.idliSambar],
  default: [IDEA.besanChilla, IDEA.pohaPeanuts, IDEA.moongChilla, IDEA.idliSambar],
};

const LIGHT_IDEAS: IdeaTable = {
  vegan: [IDEA.khichdi, IDEA.veggieSoup, IDEA.laukiSabzi],
  jain: [IDEA.moongKhichdi, IDEA.laukiSabzi],
  vegetarian: [IDEA.khichdi, IDEA.veggieSoup, IDEA.curdRice, IDEA.laukiSabzi],
  eggetarian: [IDEA.khichdi, IDEA.veggieSoup, IDEA.curdRice, IDEA.laukiSabzi],
  non_vegetarian: [IDEA.khichdi, IDEA.chickenSoup, IDEA.veggieSoup, IDEA.laukiSabzi],
  default: [IDEA.khichdi, IDEA.veggieSoup, IDEA.laukiSabzi],
};

const DINNER_IDEAS: IdeaTable = {
  vegan: [IDEA.dalSabziRoti, IDEA.dalSabziRice, IDEA.rajmaRice],
  jain: [IDEA.dalSabziRoti, IDEA.dalSabziRice, IDEA.paneerSabziRice],
  vegetarian: [IDEA.dalSabziRoti, IDEA.dalSabziRice, IDEA.rajmaRice, IDEA.paneerSabziRice],
  eggetarian: [IDEA.dalSabziRoti, IDEA.dalSabziRice, IDEA.rajmaRice, IDEA.paneerSabziRice],
  non_vegetarian: [IDEA.dalSabziRoti, IDEA.dalSabziRice, IDEA.chickenRice, IDEA.rajmaRice],
  default: [IDEA.dalSabziRoti, IDEA.dalSabziRice, IDEA.rajmaRice],
};

/** Up to `max` ideas for the diet that touch none of the allergies, as "a, b or c" — null when none are safe. */
function safeIdeas(table: IdeaTable, diet: DietKey, allergies: string[] | undefined, max: number): string | null {
  const picks = (table[diet] || table.default)
    .filter((idea) => !conflictsWithAllergies([idea.text, ...idea.contains], allergies))
    .slice(0, max)
    .map((idea) => idea.text);
  if (!picks.length) return null;
  return picks.length === 1 ? picks[0] : `${picks.slice(0, -1).join(", ")} or ${picks[picks.length - 1]}`;
}

/**
 * Everything the insight must steer clear of: profile allergies plus remembered facts such as
 * "Allergic to peanuts", "Doesn't eat mushrooms", "Dislikes karela" or "Is lactose intolerant".
 */
export { avoidList } from "@/lib/allergens";

const kcal = (n: number) => `${formatNumber(n)} kcal`;

export function buildInsight(i: InsightInput): string {
  const d: DietKey = i.diet || "default";
  const avoid = i.allergies;
  const target = Math.max(1, i.targets.calories);
  const eaten = i.totals.calories;
  const kcalLeft = Math.round(target - eaten);
  const proteinLeft = Math.round(i.targets.protein_g - i.totals.protein_g);

  /* ─── Looking back at a past day ─── */
  if (!i.isToday) {
    if (i.mealsCount === 0) return "Nothing was logged on this day — that's okay. Every day is a fresh start.";
    const diff = eaten - target;
    if (Math.abs(diff) <= target * 0.1) {
      return proteinLeft <= 5
        ? `A well-balanced day — you landed within ${kcal(Math.abs(diff))} of your target and covered your protein.`
        : `A well-balanced day — you landed within ${kcal(Math.abs(diff))} of your target.`;
    }
    if (diff > 0) return `This day ran about ${kcal(diff)} over target — totally human. One balanced day brings things back in line.`;
    if (i.mealsCount <= 1 && eaten < target * 0.6) {
      return "Only one meal was logged this day. If you missed some, you can still add them — ÖRZA keeps the picture complete.";
    }
    return `You ate about ${kcal(-diff)} under target this day. Steady, regular meals keep energy up — no need to make up for it.`;
  }

  /* ─── Today ─── */
  const h = i.hour;
  // Rough share of the day's intake typically eaten by now (7am → 0, 9pm → 1).
  const dayProgress = clamp((h - 7) / 14, 0, 1);

  if (i.mealsCount === 0) {
    if (h < 5) return "It's a quiet hour. Whenever you're ready, log your first meal and ÖRZA will take it from there.";
    if (h < 11) {
      const ideas = safeIdeas(BREAKFAST_IDEAS, d, avoid, 3);
      return ideas
        ? `Good morning — a protein-rich breakfast like ${ideas} sets a steady tone for the day.`
        : "Good morning — a protein-rich breakfast that suits you sets a steady tone for the day.";
    }
    if (h < 16) return "Nothing logged yet today. Snap your plate or just tell ÖRZA what you ate — it takes seconds.";
    return "No meals logged yet today — that's okay. Add what you've had so far and ÖRZA will help balance the rest.";
  }

  if (kcalLeft < 0) {
    const over = -kcalLeft;
    if (over <= 150) return `You're just ${kcal(over)} past your target — practically spot on. Nothing to fix here.`;
    if (h >= 20 || h < 5) {
      return `You're ${kcal(over)} over today — completely human. Tomorrow is a fresh page, and Rebalance can spread it gently over a few days.`;
    }
    const ideas = safeIdeas(LIGHT_IDEAS, d, avoid, 2);
    return ideas
      ? `You're ${kcal(over)} over today — no guilt, it happens. A lighter dinner like ${ideas}, or an evening walk, evens things out.`
      : `You're ${kcal(over)} over today — no guilt, it happens. A lighter dinner, or an evening walk, evens things out.`;
  }

  if (kcalLeft <= 150 && proteinLeft <= 10) {
    return kcalLeft <= 20
      ? "Right on your calorie target, with protein covered. Beautifully balanced."
      : `Beautifully balanced — you're within ${kcal(kcalLeft)} of your target and protein is covered.`;
  }

  if (proteinLeft >= 15 && (h >= 15 || i.totals.protein_g < i.targets.protein_g * (dayProgress - 0.25))) {
    const ideas = safeIdeas(PROTEIN_IDEAS, d, avoid, 3);
    return ideas
      ? `You're ${proteinLeft} g short on protein — ${ideas} would close the gap.`
      : `You're ${proteinLeft} g short on protein — a protein-rich snack that suits you would close the gap.`;
  }

  if (h >= 12 && i.targets.water_glasses > 0 && i.water < Math.floor(i.targets.water_glasses * dayProgress) - 1) {
    return `You're at ${i.water} of ${i.targets.water_glasses} glasses of water — keep a bottle within reach; small sips add up.`;
  }

  if (h >= 18 && kcalLeft >= 500) {
    const idea = safeIdeas(DINNER_IDEAS, d, avoid, 1);
    return idea
      ? `You still have ${kcal(kcalLeft)} for today — a balanced dinner like ${idea} would fit nicely.`
      : `You still have ${kcal(kcalLeft)} for today — a balanced dinner with protein, vegetables and a grain that suits you would fit nicely.`;
  }

  if (proteinLeft <= 0) return `Protein's covered for the day — nice work. You have ${kcal(kcalLeft)} left to enjoy, mindfully.`;

  return `${kcal(kcalLeft)} and ${proteinLeft} g protein to go — you're pacing well. Keep listening to your hunger.`;
}
