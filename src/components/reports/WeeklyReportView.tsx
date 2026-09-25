"use client";
import * as React from "react";
import { Dumbbell, Footprints, GlassWater, RotateCw, Scale, Star } from "lucide-react";
import { Eyebrow, GlassCard } from "@/components/orza/primitives";
import { EmptyState, StatCard, WellnessNote } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { OrbSurface } from "@/components/recipes/KitchenProfile";
import { formatWeight, kgToUnit } from "@/components/goals/goal-math";
import { addDays } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { DateStepper } from "./DateStepper";
import { CalorieChart, MiniBars } from "./WeeklyCharts";
import { rangeLabel, weekdayLong, type WeeklyReport } from "./format";

function WeeklySkeleton() {
  return (
    <div className="space-y-5" aria-busy aria-label="Loading weekly report">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[118px] rounded-orza-md" />
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-orza-md" />
      <div className="grid gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[210px] rounded-orza-md" />
        ))}
      </div>
    </div>
  );
}

/** Weekly tab: averages, calorie chart vs target, protein/water/steps minis and a plain-language summary. */
export function WeeklyReportView({
  report,
  loading,
  error,
  onRetry,
  end,
  today,
  onEndChange,
  imperial = false,
}: {
  report: WeeklyReport | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  end: string;
  today: string;
  onEndChange: (end: string) => void;
  /** Show weights in lb (Settings → Units); reports stay kg underneath. */
  imperial?: boolean;
}) {
  const r = report;
  const stale = !!r && r.end !== end;
  const isThisWeek = end === today;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <DateStepper
          label={rangeLabel(addDays(end, -6), end)}
          sublabel={isThisWeek ? "Last 7 days" : undefined}
          onPrev={() => onEndChange(addDays(end, -7))}
          onNext={() => onEndChange(addDays(end, 7) > today ? today : addDays(end, 7))}
          prevLabel="Previous week"
          nextLabel="Next week"
          nextDisabled={end >= today}
        />
        {!isThisWeek && (
          <Button variant="ghost" size="sm" onClick={() => onEndChange(today)}>
            Back to this week
          </Button>
        )}
      </div>

      {!r && loading ? (
        <WeeklySkeleton />
      ) : error && (!r || stale) ? (
        <EmptyState
          icon={<RotateCw size={20} strokeWidth={1.75} />}
          title="Couldn't load this week"
          description={error}
          action={
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : r ? (
        <div className={loading || stale ? "space-y-5 opacity-60 transition-opacity" : "space-y-5 transition-opacity"} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Avg calories"
              value={r.logged_days ? formatNumber(r.averages.calories) : "—"}
              unit={r.logged_days ? "kcal" : undefined}
              hint={`Target ${formatNumber(r.targets.calories)} kcal`}
            />
            <StatCard
              label="Avg protein"
              value={r.logged_days ? formatNumber(r.averages.protein_g) : "—"}
              unit={r.logged_days ? "g" : undefined}
              hint={`Target ${formatNumber(r.targets.protein_g)} g`}
            />
            <StatCard
              label="On-target days"
              value={r.adherence}
              unit={`of ${r.logged_days}`}
              hint="Within ±10% of your calories"
            />
            <StatCard label="Days logged" value={r.logged_days} unit="of 7" hint={r.logged_days === 7 ? "A full week — lovely consistency" : "Days with at least one meal"} />
          </div>

          <GlassCard variant="strong" padded={false} className="p-5 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Eyebrow>Calories</Eyebrow>
                <h2 className="mt-1.5 font-editorial text-[21px] font-semibold leading-tight tracking-[-0.01em] text-orza-strong">Your week, day by day</h2>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-orza-muted" aria-hidden>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px] bg-orza-energy" /> Logged calories
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-4 border-t-[1.5px] border-dashed border-[rgba(194,65,12,0.7)]" /> Target {formatNumber(r.targets.calories)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-[3px] bg-[rgba(18,122,86,0.14)]" /> ±10% range
                </span>
              </div>
            </div>
            <div className="mt-8">
              <CalorieChart days={r.days} target={r.targets.calories} today={today} bestDate={r.logged_days > 1 ? r.best_day?.date : undefined} />
            </div>
          </GlassCard>

          <div className="grid gap-5 lg:grid-cols-3">
            <MiniBars
              title="Protein"
              icon={<Dumbbell size={16} strokeWidth={1.75} aria-hidden />}
              days={r.days}
              value={(d) => d.protein_g}
              target={r.targets.protein_g}
              unit="g"
              tone="violet"
              average={`${formatNumber(r.averages.protein_g)} g`}
              today={today}
            />
            <MiniBars
              title="Water"
              icon={<GlassWater size={16} strokeWidth={1.75} aria-hidden />}
              days={r.days}
              value={(d) => d.water_glasses}
              target={r.targets.water_glasses}
              unit="glasses"
              tone="cyan"
              average={String(r.averages.water_glasses)}
              today={today}
            />
            <MiniBars
              title="Steps"
              icon={<Footprints size={16} strokeWidth={1.75} aria-hidden />}
              days={r.days}
              value={(d) => d.steps}
              target={r.targets.steps}
              unit="steps"
              tone="success"
              average={formatNumber(r.averages.steps)}
              today={today}
            />
          </div>

          <OrbSurface className="p-6 sm:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-end">
              <div>
                <Eyebrow tone="dark">Your week in words</Eyebrow>
                <p className="mt-3 max-w-2xl font-editorial text-[19px] leading-[1.5] text-white sm:text-[21px]">{r.summary}</p>
              </div>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-orza-sm border border-white/15 bg-white/[0.07] px-4 py-3">
                  <dt className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">
                    <Star size={12} strokeWidth={2} className="text-[#FFB454]" aria-hidden /> Most balanced day
                  </dt>
                  <dd className="mt-1 text-[15px] text-white/90">
                    {r.best_day && r.logged_days > 1 ? `${weekdayLong(r.best_day.date)} · score ${r.best_day.score}` : "Log two or more days to see it"}
                  </dd>
                </div>
                <div className="rounded-orza-sm border border-white/15 bg-white/[0.07] px-4 py-3">
                  <dt className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">
                    <Scale size={12} strokeWidth={2} className="text-[#FFB454]" aria-hidden /> Weigh-ins
                  </dt>
                  <dd className="mt-1 text-[15px] tabular-nums text-white/90">
                    {r.weight
                      ? r.weight.entries > 1
                        ? `${kgToUnit(r.weight.first, imperial)} → ${formatWeight(r.weight.last, imperial)}`
                        : formatWeight(r.weight.last, imperial)
                      : "No weigh-ins this week"}
                  </dd>
                </div>
              </dl>
            </div>
          </OrbSurface>

          <WellnessNote className="text-center" />
        </div>
      ) : null}
    </div>
  );
}
