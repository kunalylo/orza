import * as React from "react";
import { Camera, ChefHat, HeartHandshake, MessageCircle, PenLine, RotateCcw, ShieldCheck, type LucideIcon } from "lucide-react";
import { Eyebrow, GlassCard, IconTile } from "@/components/orza/primitives";
import { CREDIT_ACTION_ROWS } from "@/components/account/options";
import type { CreditCosts } from "@/components/account/types";
import type { CreditAction } from "@/lib/credits";
import { cn } from "@/lib/utils";

export const ACTION_ICONS: Record<CreditAction, LucideIcon> = {
  scan: Camera,
  meal_text: PenLine,
  chat: MessageCircle,
  recipe: ChefHat,
  compensation: HeartHandshake,
  report_insight: ShieldCheck,
};

const TONES: Record<string, "cyan" | "energy" | "violet" | "neutral"> = {
  scan: "energy",
  meal_text: "cyan",
  chat: "violet",
  recipe: "energy",
  compensation: "neutral",
};

/** "What costs credits" — the per-action price list plus what always stays free. */
export function CostsCard({ costs, aiEnabled, className }: { costs: CreditCosts; aiEnabled: boolean; className?: string }) {
  return (
    <GlassCard as="section" id="costs" aria-labelledby="costs-title" variant="strong" className={cn("h-full scroll-mt-24", className)}>
      <Eyebrow className="text-[11px]">What costs credits</Eyebrow>
      <h2 id="costs-title" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
        Only AI uses credits
      </h2>

      <table className="mt-5 w-full border-collapse text-left">
        <caption className="sr-only">Credits charged for each AI action</caption>
        <thead>
          <tr className="border-b border-[rgba(20,20,20,0.08)]">
            <th scope="col" className="pb-2 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-orza-subtle">
              AI action
            </th>
            <th scope="col" className="pb-2 text-right font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-orza-subtle">
              Credits
            </th>
          </tr>
        </thead>
        <tbody>
          {CREDIT_ACTION_ROWS.map((row) => {
            const Icon = ACTION_ICONS[row.key];
            const cost = costs[row.key] ?? 0;
            return (
              <tr key={row.key} className="border-b border-[rgba(20,20,20,0.06)] last:border-0">
                <th scope="row" className="py-3 pr-3 font-normal">
                  <span className="flex items-center gap-3">
                    <IconTile tone={TONES[row.key] ?? "neutral"} className="h-8 w-8">
                      <Icon size={15} strokeWidth={1.75} aria-hidden />
                    </IconTile>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-orza-strong">{row.label}</span>
                      <span className="block text-[12px] leading-snug text-orza-subtle">{row.hint}</span>
                    </span>
                  </span>
                </th>
                <td className="py-3 text-right align-middle">
                  <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                    <span className="font-editorial text-[22px] font-semibold tabular-nums text-orza-strong">{cost}</span>
                    <span className="text-[12px] text-orza-subtle">{cost === 1 ? "credit" : "credits"}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ul className="mt-5 space-y-2.5 rounded-orza-sm border border-[rgba(18,122,86,0.18)] bg-[#EAF7F1]/70 p-4 text-[13px] leading-relaxed text-orza-strong">
        <li className="flex gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#127A56]" aria-hidden />
          <span>
            <span className="font-medium">Non-AI logging is always free</span> — manual meals, water, steps and weight never use credits.
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#127A56]" aria-hidden />
          <span>
            <span className="font-medium">{aiEnabled ? "If AI is ever unavailable" : "While AI is unavailable"}</span>, ÖRZA&rsquo;s built-in engine handles
            logging, chat, recipes and plans — for free.
          </span>
        </li>
        <li className="flex gap-2.5">
          <RotateCcw size={13} strokeWidth={2} className="mt-[3px] shrink-0 text-[#127A56]" aria-hidden />
          <span>If an AI request fails, the credits are refunded automatically.</span>
        </li>
      </ul>
    </GlassCard>
  );
}
