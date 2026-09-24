/**
 * Which foods each profile diet eats. Client-safe (no food data), shared by the parser, the food
 * search ranking and the food picker's suggestions.
 */
import type { Diet } from "@/lib/types";
import type { FoodDiet } from "./types";

/** Profile diets that exclude meat and fish. */
export function avoidsMeat(diet: Diet | undefined | null): boolean {
  return diet === "vegetarian" || diet === "vegan" || diet === "jain" || diet === "eggetarian";
}

/** Does a food marked `food` (veg / vegan / egg / nonveg) fit the profile diet? No diet set = everything fits. */
export function dietAllowsFood(diet: Diet | undefined | null, food: FoodDiet): boolean {
  if (diet === "vegan") return food === "vegan";
  if (diet === "vegetarian" || diet === "jain") return food === "vegan" || food === "veg";
  if (diet === "eggetarian") return food !== "nonveg";
  return true;
}
