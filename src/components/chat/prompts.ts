import { Activity, BookOpen, Moon, Sparkles, UtensilsCrossed, Zap, type LucideIcon } from "lucide-react";

/**
 * Starter prompts shown on an empty conversation (from the ÖRZA landing page).
 * `send: true` asks straight away. Meal statements ("… khaya", "I had …") would log a real meal, so
 * they only fill the composer for the user to edit and send themselves.
 */
export type StarterPrompt = { text: string; send: boolean };

export const STARTER_PROMPTS: StarterPrompt[] = [
  { text: "Today I had a wedding meal", send: false },
  { text: "Mujhe high protein dinner chahiye", send: true },
  { text: "Aaj maine breakfast mein do paratha aur dahi khaya", send: false },
  { text: "What should I eat for dinner?", send: true },
  { text: "How am I doing today?", send: true },
];

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
