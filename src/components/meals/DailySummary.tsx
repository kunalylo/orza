"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Nutrients, Targets } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { EnergyRing, Eyebrow, GlassCard } from "@/components/orza/primitives";
import { MacroRow } from "@/components/app/ui";
import { Skeleton } from "@/components/ui/form";

/** Day totals vs the user's targets: energy ring for calories + macro bars. */
export function DailySummary({
  totals,
  targets,
  dayLabel,
  loading,
}: {
  totals: Nutrients | null;
  targets: Targets;
  dayLabel: string;
  loading?: boolean;
}) {
  if (loading || !totals) {
    return (
      <GlassCard variant="strong" aria-busy className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-5">
          <Skeleton className="h-[128px] w-[128px] !rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  const target = targets.calories || 0;
  const remaining = Math.round(target - totals.calories);
  const over = target > 0 && remaining < 0;

  return (
    <GlassCard variant="strong" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60 blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(255,180,84,0.28) 0%, rgba(255,122,106,0.14) 45%, rgba(255,95,162,0) 70%)" }}
      />
      <div className="relative grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10">
        <div className="flex items-center gap-5">
          <EnergyRing value={totals.calories} max={target} size={128} stroke={10} id="meal-log-ring">
            <span className="font-editorial text-[26px] font-semibold leading-none text-orza-strong tabular-nums">{formatNumber(totals.calories)}</span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">kcal</span>
          </EnergyRing>
          <div className="min-w-0">
            <Eyebrow className="text-[11px]">{dayLabel} · Totals</Eyebrow>
            <div className="mt-1.5 font-editorial text-[22px] font-semibold leading-7 text-orza-strong">
              {target <= 0 ? "No calorie target yet" : over ? `${formatNumber(-remaining)} kcal over` : `${formatNumber(remaining)} kcal left`}
            </div>
            <p className="mt-1 text-[13px] leading-snug text-orza-muted">
              {target > 0 ? <>of your {formatNumber(target)} kcal target</> : <>Set one in Goals whenever you like.</>}
              {over && <> — that&apos;s okay, one day doesn&apos;t define you.</>}
            </p>
            {over && (
              <Link
                href="/dashboard/compensation"
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[#C2410C] hover:underline"
              >
                Plan a gentle rebalance <ArrowUpRight size={13} strokeWidth={2} aria-hidden />
              </Link>
            )}
          </div>
        </div>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <MacroRow label="Protein" value={totals.protein_g} target={targets.protein_g} tone="cyan" />
          <MacroRow label="Carbs" value={totals.carbs_g} target={targets.carbs_g} tone="energy" />
          <MacroRow label="Fat" value={totals.fat_g} target={targets.fat_g} tone="violet" />
          <MacroRow label="Fibre" value={totals.fiber_g} target={targets.fiber_g} tone="success" />
        </div>
      </div>
    </GlassCard>
  );
}
