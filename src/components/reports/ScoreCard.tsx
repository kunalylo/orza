"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EnergyRing, Eyebrow, GlassCard } from "@/components/orza/primitives";
import { cn, formatNumber } from "@/lib/utils";
import { scoreMood, type DailyReport } from "./format";

/** Day score in the energy ring (like the ecosystem site's Energy Index) with its weighted contributors. */
export function ScoreCard({ report }: { report: DailyReport }) {
  const reduce = useReducedMotion();
  return (
    <GlassCard variant="strong" padded={false} className="p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Day score</Eyebrow>
        <span className="text-xs text-orza-subtle">Out of 100</span>
      </div>
      <div className="mt-4 grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center">
          <EnergyRing value={report.score} max={100} size={188} stroke={11} id="orza-report-ring">
            <span className="font-editorial text-[56px] font-semibold leading-none tracking-[-0.03em] text-orza-strong tabular-nums">{report.score}</span>
            <span className="mt-1 text-xs text-orza-muted">/ 100</span>
          </EnergyRing>
          <p className="mt-2 text-center font-editorial text-[17px] text-orza-strong">{scoreMood(report)}</p>
        </div>

        <ul className="space-y-2" aria-label="How the score is made">
          {report.score_parts.map((p, i) => {
            const full = p.points >= p.max;
            return (
              <motion.li
                key={p.key}
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/55 px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium text-orza-strong">{p.label}</span>
                  <span
                    className={cn("font-mono text-[12px] tabular-nums", full ? "text-[#127A56]" : "text-orza-muted")}
                    aria-label={`${p.points} of ${p.max} points`}
                  >
                    {p.points}/{p.max}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(20,20,20,0.07)]" aria-hidden>
                    <div
                      className="h-full rounded-full bg-orza-energy transition-[width] duration-700 ease-orza-out"
                      style={{ width: `${p.max ? (p.points / p.max) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-orza-subtle">
                    {formatNumber(p.value)} / {formatNumber(p.target)} {p.unit}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-orza-subtle">
        Calories within ±10% of target (35), protein at 90% of goal (25), water (15), steps (15) and fibre (10).
      </p>
    </GlassCard>
  );
}
