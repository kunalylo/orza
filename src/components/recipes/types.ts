import type { TagTone } from "@/components/orza/primitives";
import type { Diet, Recipe } from "@/lib/types";

/** A recipe as returned by /api/recipes (the shared Recipe plus provenance). */
export type RecipeItem = Recipe & {
  source?: "ai" | "library";
  library_key?: string;
  prompt?: string;
};

/** The diets and foods every recipe is checked against: profile + what ÖRZA learned in chat. */
export interface KitchenPrefs {
  /** Strictest first. */
  diets: Diet[];
  avoid: string[];
}

export interface RecipesResponse {
  recipes: RecipeItem[];
  ai_enabled: boolean;
  cost: number;
  kitchen?: KitchenPrefs;
}

export interface GenerateRequest {
  prompt?: string;
  max_calories?: number;
  cuisine?: string;
  diet?: Diet;
}

export interface GenerateResponse {
  recipe: RecipeItem;
  ai: boolean;
  credits?: number;
  notice?: string;
}

export const DIET_LABELS: Record<Diet, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  eggetarian: "Eggetarian",
  non_vegetarian: "Non-vegetarian",
  jain: "Jain",
};

/** Cuisine choices. Values are what the API understands; labels are for people. */
export const CUISINE_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  {
    label: "Across India",
    options: [
      { value: "North Indian", label: "North Indian" },
      { value: "South Indian", label: "South Indian" },
      { value: "West Indian", label: "West Indian" },
      { value: "East Indian", label: "East & North-East Indian" },
    ],
  },
  {
    label: "Regional",
    options: ["Punjabi", "Rajasthani", "Gujarati", "Maharashtrian", "Goan", "Bengali", "Assamese", "Bihari", "Kerala", "Tamil", "Karnataka", "Andhra", "Hyderabadi"].map(
      (c) => ({ value: c, label: c })
    ),
  },
  {
    label: "Global",
    options: ["Mediterranean", "Middle Eastern", "East Asian", "Mexican", "Continental"].map((c) => ({ value: c, label: c })),
  },
];

export const CALORIE_OPTIONS = [300, 400, 500, 600, 800] as const;

export const EXAMPLE_PROMPTS = [
  "High-protein veg dinner under 500 kcal",
  "Quick South Indian breakfast",
  "Jain-friendly lunch",
  "Comfort dal for a rainy evening",
  "Tiffin-friendly lunch under 400 kcal",
];

/** Tags worth showing on a card, in a friendly order (region/meal/internal tags are hidden). */
const TAG_LABELS: Record<string, { label: string; tone: TagTone }> = {
  vegan: { label: "Vegan", tone: "success" },
  vegetarian: { label: "Vegetarian", tone: "success" },
  eggetarian: { label: "Eggetarian", tone: "warning" },
  non_vegetarian: { label: "Non-veg", tone: "neutral" },
  jain: { label: "Jain", tone: "success" },
  "high-protein": { label: "High protein", tone: "energy" },
  "low-carb": { label: "Low carb", tone: "info" },
  "low-calorie": { label: "Light", tone: "info" },
  "high-fibre": { label: "High fibre", tone: "violet" },
  quick: { label: "Quick", tone: "neutral" },
  "gluten-free": { label: "Gluten-free", tone: "neutral" },
};

const TAG_ORDER = Object.keys(TAG_LABELS);

export function displayTags(tags: string[], max = 6) {
  const set = new Set(tags);
  // Vegan recipes also carry "vegetarian"; showing both is noise.
  if (set.has("vegan")) set.delete("vegetarian");
  return TAG_ORDER.filter((t) => set.has(t))
    .slice(0, max)
    .map((t) => ({ key: t, ...TAG_LABELS[t] }));
}
