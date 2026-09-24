"use client";
import * as React from "react";
import { LineChart } from "lucide-react";
import type { PublicUser, TrackingDay } from "@/lib/types";
import { Eyebrow, GlassCard } from "@/components/orza/primitives";
import { Segmented } from "@/components/ui/form";
import { LogWeightForm } from "@/components/goals/LogWeightForm";
import { WeightChart, WeightTable } from "@/components/goals/WeightChart";
import { formatKg, formatShortDate } from "@/components/goals/goal-math";
import type { WeightPoint } from "@/components/goals/types";

/** Weight trend (last 120 days) with a chart/table toggle and inline "log today's weight". */
export function WeightTrendCard({
  points,
  target,
  onLogged,
}: {
  points: WeightPoint[];
  target?: number | null;
  onLogged: (weightKg: number, tracking?: TrackingDay, user?: PublicUser) => void;
}) {
  const [view, setView] = React.useState<"chart" | "table">("chart");
  const n = points.length;
  const first = points[0];
  const last = points[n - 1];
  const change = n > 1 ? Math.round((last.weight_kg - first.weight_kg) * 10) / 10 : null;

  return (
    <GlassCard variant="strong" className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>Weight trend</Eyebrow>
          {last ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-editorial text-[28px] font-semibold leading-none tracking-[-0.02em] text-orza-strong tabular-nums">{formatKg(last.weight_kg)}</span>
              <span className="text-[13px] text-orza-muted">
                {change == null
                  ? `on ${formatShortDate(last.date)}`
                  : change === 0
                    ? `steady since ${formatShortDate(first.date)}`
                    : `${change > 0 ? "+" : "−"}${Math.abs(change)} kg since ${formatShortDate(first.date)}`}
              </span>
            </div>
          ) : (
            <div className="mt-2 font-editorial text-[22px] font-semibold leading-tight text-orza-strong">Last 120 days</div>
          )}
        </div>
        {n > 1 && (
          <Segmented<"chart" | "table">
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        )}
      </div>

      <div className="mt-5 flex-1">
        {n === 0 ? (
          <div className="flex h-[230px] flex-col items-center justify-center rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.14)] bg-white/40 px-6 text-center">
            <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-orza-muted shadow-orza-glass" aria-hidden>
              <LineChart size={18} strokeWidth={1.75} />
            </span>
            <div className="font-editorial text-[17px] font-semibold text-orza-strong">No weigh-ins yet</div>
            <p className="mt-1 max-w-xs text-[13px] text-orza-muted">Log your first one below — your trend line starts building from there.</p>
          </div>
        ) : view === "table" && n > 1 ? (
          <WeightTable points={points} />
        ) : (
          <>
            <WeightChart points={points} target={target} />
            {n === 1 && <p className="mt-2 text-center text-[12px] text-orza-subtle">One weigh-in so far — log another in a few days to see your trend.</p>}
          </>
        )}
      </div>

      <div className="mt-5 border-t border-[rgba(20,20,20,0.08)] pt-5">
        <LogWeightForm placeholder={last?.weight_kg} onLogged={onLogged} />
      </div>
    </GlassCard>
  );
}
