"use client";
import * as React from "react";
import { ArrowRight, CalendarDays, Check, RotateCw, Sparkles, UtensilsCrossed } from "lucide-react";
import { Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";
import { EmptyState, MacroRow, WellnessNote } from "@/components/app/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Skeleton } from "@/components/ui/form";
import { addDays } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { DateStepper } from "./DateStepper";
import { ScoreCard } from "./ScoreCard";
import { dayLabel, longDate, MEAL_LABELS, type DailyReport } from "./format";

function CardTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-1.5 font-editorial text-[21px] font-semibold leading-tight tracking-[-0.01em] text-orza-strong">{title}</h2>
    </div>
  );
}

function DailySkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-busy aria-label="Loading daily report">
      <Skeleton className="h-[420px] rounded-orza-md" />
      <Skeleton className="h-[420px] rounded-orza-md" />
      <Skeleton className="h-[200px] rounded-orza-md" />
      <Skeleton className="h-[200px] rounded-orza-md" />
    </div>
  );
}

/** Daily tab: date navigation, score ring, totals vs targets, highlights, suggestions and meals. */
export function DailyReportView({
  report,
  loading,
  error,
  onRetry,
  date,
  today,
  onDateChange,
}: {
  report: DailyReport | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  date: string;
  today: string;
  onDateChange: (date: string) => void;
}) {
  // Keep the previous day on screen (dimmed) while the next one loads.
  const r = report;
  const stale = !!r && r.date !== date;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <DateStepper
          label={dayLabel(date, today)}
          sublabel={date === today ? "So far today" : undefined}
          onPrev={() => onDateChange(addDays(date, -1))}
          onNext={() => onDateChange(addDays(date, 1))}
          prevLabel="Previous day"
          nextLabel="Next day"
          nextDisabled={date >= today}
        />
        <label className="relative inline-flex items-center">
          <span className="sr-only">Pick a date</span>
          <CalendarDays size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 text-orza-muted" aria-hidden />
          <Input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && e.target.value <= today && onDateChange(e.target.value)}
            className="h-10 w-[172px] rounded-full pl-9 text-[14px]"
          />
        </label>
        {date !== today && (
          <Button variant="ghost" size="sm" onClick={() => onDateChange(today)}>
            Back to today
          </Button>
        )}
      </div>

      {!r && loading ? (
        <DailySkeleton />
      ) : error && (!r || stale) ? (
        <EmptyState
          icon={<RotateCw size={20} strokeWidth={1.75} />}
          title="Couldn't load this report"
          description={error}
          action={
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          }
        />
      ) : r ? (
        <div className={loading || stale ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          <div className="grid gap-5 lg:grid-cols-2">
            <ScoreCard report={r} />

            <GlassCard padded={false} className="p-5 sm:p-7">
              <CardTitle eyebrow="Totals vs targets" title={longDate(r.date)} />
              <div className="mt-5 space-y-4">
                <MacroRow label="Calories" value={r.totals.calories} target={r.targets.calories} unit="kcal" />
                <MacroRow label="Protein" value={r.totals.protein_g} target={r.targets.protein_g} tone="violet" />
                <MacroRow label="Carbs" value={r.totals.carbs_g} target={r.targets.carbs_g} />
                <MacroRow label="Fat" value={r.totals.fat_g} target={r.targets.fat_g} />
                <MacroRow label="Fibre" value={r.totals.fiber_g} target={r.targets.fiber_g} tone="success" />
                <div className="border-t border-[rgba(20,20,20,0.07)] pt-4" />
                <MacroRow label="Water" value={r.tracking.water_glasses} target={r.targets.water_glasses} unit="glasses" tone="cyan" />
                <MacroRow label="Steps" value={r.tracking.steps} target={r.targets.steps} unit="steps" tone="success" />
              </div>
              {r.tracking.weight_kg ? (
                <p className="mt-4 text-[13px] text-orza-muted">
                  Weigh-in: <span className="font-medium tabular-nums text-orza-strong">{r.tracking.weight_kg} kg</span>
                </p>
              ) : null}
            </GlassCard>

            <GlassCard padded={false} className="p-5 sm:p-7">
              <CardTitle eyebrow="Highlights" title="What went well" />
              {r.highlights.length ? (
                <ul className="mt-4 space-y-3">
                  {r.highlights.map((h) => (
                    <li key={h} className="flex gap-3 text-[14.5px] leading-relaxed text-orza-strong">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAF7F1] text-[#127A56]" aria-hidden>
                        <Check size={13} strokeWidth={2.4} />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[14px] leading-relaxed text-orza-muted">
                  Log meals, water or steps and ÖRZA will point out what&apos;s going well.
                </p>
              )}
            </GlassCard>

            <GlassCard padded={false} className="p-5 sm:p-7">
              <CardTitle eyebrow="Suggestions" title="Gentle next steps" />
              {r.suggestions.length ? (
                <ul className="mt-4 space-y-3">
                  {r.suggestions.map((s) => (
                    <li key={s} className="flex gap-3 text-[14.5px] leading-relaxed text-orza-strong">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF1EA] text-[#E0593F]" aria-hidden>
                        <Sparkles size={12} strokeWidth={2.2} />
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[14px] leading-relaxed text-orza-muted">
                  {r.is_today ? "Nothing to adjust — enjoy the rest of your day." : "Nothing to adjust for this day."}
                </p>
              )}
              <WellnessNote className="mt-5" />
            </GlassCard>
          </div>

          <GlassCard padded={false} className="mt-5 p-5 sm:p-7">
            <div className="flex items-end justify-between gap-3">
              <CardTitle eyebrow={`Meals · ${r.meals.length}`} title={r.is_today ? "Logged today" : "Logged that day"} />
              <ButtonLink href="/dashboard/meals" variant="ghost" size="sm" className="shrink-0">
                Meal log <ArrowRight size={14} strokeWidth={1.9} aria-hidden />
              </ButtonLink>
            </div>
            {r.meals.length ? (
              <ul className="mt-4 divide-y divide-[rgba(20,20,20,0.07)]">
                {r.meals.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 py-3">
                    <Tag tone="neutral" size="sm" className="mt-0.5 shrink-0">
                      {MEAL_LABELS[m.meal_type] || m.meal_type}
                    </Tag>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[14.5px] leading-snug text-orza-strong">
                        {m.items.map((i) => i.name).join(", ") || m.description || "Meal"}
                      </p>
                      <p className="mt-0.5 text-[12.5px] tabular-nums text-orza-subtle">
                        {m.totals.protein_g} g protein · {m.totals.carbs_g} g carbs · {m.totals.fat_g} g fat
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-medium tabular-nums text-orza-strong">{formatNumber(m.totals.calories)} kcal</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                className="mt-4 py-10"
                icon={<UtensilsCrossed size={20} strokeWidth={1.75} />}
                title={r.is_today ? "No meals logged today" : "No meals logged on this day"}
                description="Snap a photo, type or speak what you ate — your report fills in automatically."
                action={
                  r.is_today ? (
                    <ButtonLink href="/dashboard/meals" variant="primary" size="sm">
                      Log a meal
                    </ButtonLink>
                  ) : undefined
                }
              />
            )}
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
