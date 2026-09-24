import { Activity, BookOpen, Moon, Sparkles, UtensilsCrossed, Zap, type LucideIcon } from "lucide-react";

/** Starter prompts shown on an empty conversation (from the ÖRZA landing page). */
export const STARTER_PROMPTS = [
  "Today I had a wedding meal",
  "Mujhe high protein dinner chahiye",
  "Aaj maine breakfast mein do paratha aur dahi khaya",
  "What should I eat for dinner?",
  "How am I doing today?",
] as const;

export type QuickAction = { label: string; icon: LucideIcon; prompt?: string; prefill?: string };

/**
 * Quick actions (from the original ÖRZA chat screen): on the welcome screen and above the composer.
 * `prompt` sends straight away; `prefill` drops a starter into the composer instead.
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Plan my day", icon: Sparkles, prompt: "Plan my day" },
  { label: "Log a meal", icon: UtensilsCrossed, prefill: "I had " },
  { label: "Sleep tips", icon: Moon, prompt: "Sleep tips" },
  { label: "Suggest a recipe", icon: BookOpen, prompt: "Suggest a recipe" },
  { label: "Activity ideas", icon: Activity, prompt: "Activity ideas" },
  { label: "Rebalance help", icon: Zap, prompt: "Rebalance help" },
];
