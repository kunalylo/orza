import { Camera, ChefHat, ChartColumn, MessageCircle, RefreshCcw, Utensils, type LucideIcon } from "lucide-react";
import { CREDIT_COSTS, type CreditAction } from "@/lib/credits";

/** Human labels for each metered AI action. Costs always come from the live `CREDIT_COSTS` table. */
const ACTIONS: Record<CreditAction, { label: string; icon: LucideIcon }> = {
  scan: { label: "Meal photo scan", icon: Camera },
  recipe: { label: "Recipe generation", icon: ChefHat },
  chat: { label: "AI chat message", icon: MessageCircle },
  meal_text: { label: "Text or voice meal log", icon: Utensils },
  compensation: { label: "Rebalance plan", icon: RefreshCcw },
  report_insight: { label: "Report insight", icon: ChartColumn },
};

export type CreditActionRow = { key: CreditAction; cost: number; label: string; icon: LucideIcon };

/** Server-only helper (reads the credit table): every AI action with its label, icon and cost. */
export function creditActionRows(): CreditActionRow[] {
  return (Object.keys(ACTIONS) as CreditAction[]).map((key) => ({ key, cost: CREDIT_COSTS[key], ...ACTIONS[key] }));
}

export function creditsLabel(n: number) {
  return `${n} ${n === 1 ? "credit" : "credits"}`;
}
