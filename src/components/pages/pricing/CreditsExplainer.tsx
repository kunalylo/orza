import { Coins } from "lucide-react";
import { INITIAL_CREDITS } from "@/lib/credits";
import { Eyebrow, GlassCard } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { creditActionRows, creditsLabel } from "./credit-actions";

/** Server component: explains AI credits using the real costs from `CREDIT_COSTS`. */
export function CreditsExplainer() {
  const rows = creditActionRows();

  return (
    <Reveal>
      <GlassCard variant="subtle" padded={false} className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_1.35fr] lg:items-center lg:gap-12">
        <div>
          <div className="flex items-center gap-2">
            <Coins size={14} strokeWidth={1.75} className="text-orza-warning" aria-hidden />
            <Eyebrow>How AI credits work</Eyebrow>
          </div>
          <h2 className="mt-3 font-editorial text-[26px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[30px]">
            {INITIAL_CREDITS} free AI credits when you sign up.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-orza-muted">
            In the ÖRZA web app, AI actions are measured in credits. Manual logging is always free, features that
            don&apos;t use AI never cost credits, and if an AI request doesn&apos;t go through, its credits are refunded
            automatically.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Credits per AI action">
          {rows.map(({ key, cost, label, icon: Icon }) => (
            <li key={key} className="rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/70 px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <Icon size={16} strokeWidth={1.75} className="text-orza-muted" aria-hidden />
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-orza-warning">{creditsLabel(cost)}</span>
              </div>
              <div className="mt-2 text-[13px] font-medium leading-snug text-orza-strong">{label}</div>
            </li>
          ))}
        </ul>
      </GlassCard>
    </Reveal>
  );
}
