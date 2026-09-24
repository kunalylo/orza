/**
 * ÖRZA built-in Indian + global food database and natural-language meal parser.
 * Used as the no-AI fallback for text/voice/chat meal logging, and to sanity-check AI output.
 *
 * INTERFACE CONTRACT — other modules import exactly these exports:
 *   FOODS, findFood, searchFoods, parseMealText, nutrientsFor (+ types FoodEntry, FoodDiet)
 *   ITEM_LIMITS, MAX_SERVINGS, maxServingsFor, clampToItemLimits — one meal item's size limits
 *
 * parseMealText(text, { diet }) — pass the user's profile diet so ambiguous words ("biryani",
 * "kathi roll") resolve to the version they eat.
 *
 * Layout: foods.ts (data) · text.ts (vocabulary) · matcher.ts (findFood/searchFoods) ·
 * nutrients.ts (nutrientsFor) · parser.ts (parseMealText) · diet.ts (diet-aware variants) ·
 * limits.ts (item limits; client-safe — client code imports "@/lib/nutrition/limits" directly).
 */
export type { FoodDiet, FoodEntry } from "./types";
export { FOODS } from "./foods";
export { findFood, searchFoods } from "./matcher";
export { nutrientsFor } from "./nutrients";
export { parseMealText } from "./parser";
export { ITEM_LIMITS, MAX_SERVINGS, clampToItemLimits, maxServingsFor } from "./limits";
