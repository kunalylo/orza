/**
 * ÖRZA built-in Indian + global food database and natural-language meal parser.
 * Used as the no-AI fallback for text/voice/chat meal logging, and to sanity-check AI output.
 *
 * INTERFACE CONTRACT — other modules import exactly these exports:
 *   FOODS, findFood, searchFoods, parseMealText, nutrientsFor (+ types FoodEntry, FoodDiet)
 *
 * Layout: foods.ts (data) · text.ts (vocabulary) · matcher.ts (findFood/searchFoods) ·
 * nutrients.ts (nutrientsFor) · parser.ts (parseMealText).
 */
export type { FoodDiet, FoodEntry } from "./types";
export { FOODS } from "./foods";
export { findFood, searchFoods } from "./matcher";
export { nutrientsFor } from "./nutrients";
export { parseMealText } from "./parser";
