import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, HeartHandshake } from "lucide-react";
import { EnergyRing, Eyebrow, GlassCard } from "@/components/orza/primitives";
import { MacroRow } from "@/components/app/ui";
import type { Nutrients, Targets } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

/** Hero card: calories ring (remaining in the centre) + macro rows, after the site's Energy Index. */
export function EnergyCard({
  totals,
  targets,
  remaining,
  isToday,
}: {
  totals: Nutrients;
  targets: Targets;
  remaining: { calories: number; protein_g: number };
  isToday: boolean;
}) {
  const over = remaining.calories < 0;
  const pct = targets.calories > 0 ? Math.round((totals.calories / targets.calories) * 100) : 0;

  return (
    <GlassCard variant="strong" padded={false} className="relative h-full overflow-hidden p-5 sm:p-7">
      {/* warm halo, top-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-[320px] w-[320px] rounded-full"
        style={{
          background: "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.22) 0%, rgba(255,95,162,0.08) 45%, rgba(0,0,0,0) 70%)",
          filter: "blur(8px)",
        }}
      />

      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
        <EnergyRing id="today-energy" value={totals.calories} max={targets.calories} size={208} stroke={12} className="shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{over ? "Over target" : "Kcal left"}</span>
          <span
            className="mt-1.5 font-editorial text-[50px] leading-none tracking-[-0.03em] text-orza-strong tabular-nums"
            aria-label={over ? `${Math.abs(remaining.calories)} kilocalories over target` : `${remaining.calories} kilocalories left`}
          >
            {over ? "+" : ""}
            {formatNumber(Math.abs(remaining.calories))}
          </span>
          <span className="mt-2 text-xs text-orza-muted">of {formatNumber(targets.calories)} kcal</span>
        </EnergyRing>

        <div className="w-full min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Energy balance</Eyebrow>
            <span className="font-mono text-[11px] tabular-nums text-orza-subtle">{pct}%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-editorial text-[34px] font-semibold leading-none tracking-[-0.02em] text-orza-strong tabular-nums">
              {formatNumber(totals.calories)}
            </span>
            <span className="text-sm text-orza-muted">kcal eaten{isToday ? " today" : ""}</span>
          </div>

          <div className="mt-5 grid gap-3.5">
            <MacroRow label="Protein" value={totals.protein_g} target={targets.protein_g} tone="energy" />
            <MacroRow label="Carbs" value={totals.carbs_g} target={targets.carbs_g} tone="cyan" />
            <MacroRow label="Fat" value={totals.fat_g} target={targets.fat_g} tone="violet" />
            <MacroRow label="Fiber" value={totals.fiber_g} target={targets.fiber_g} tone="success" />
          </div>
        </div>
      </div>

      {over && (
        <Link
          href="/dashboard/compensation"
          className="group relative mt-6 flex items-center gap-3 rounded-orza-sm border border-[rgba(255,122,106,0.28)] bg-[#FFF1EA]/80 px-4 py-3 transition-colors duration-150 ease-orza hover:bg-[#FFF1EA]"
        >
          <HeartHandshake size={18} strokeWidth={1.75} className="shrink-0 text-[#E0593F]" aria-hidden />
          <span className="min-w-0 flex-1 text-[14px] leading-snug text-orza-strong">
            <span className="font-medium">Enjoyed a special meal?</span>{" "}
            <span className="text-orza-muted">Get a supportive rebalance plan — no guilt.</span>
          </span>
          <ArrowUpRight size={16} strokeWidth={1.75} className="shrink-0 text-orza-muted transition-colors group-hover:text-orza-strong" aria-hidden />
        </Link>
      )}
    </GlassCard>
  );
}
