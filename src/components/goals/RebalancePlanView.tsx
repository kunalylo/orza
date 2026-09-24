"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, Flame, Footprints, Leaf, UtensilsCrossed } from "lucide-react";
import type { CompensationDay } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Bar, Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";
import { OrbPanel } from "@/components/goals/OrbPanel";
import { formatDayDate } from "@/components/goals/goal-math";
import type { RebalancePlan } from "@/components/goals/types";

const MEAL_PREFIX = /^(breakfast|lunch|dinner|snack|evening snack)\s*[:\-–—]\s*/i;

/** "Lunch: Rajma with brown rice" → { label: "Lunch", text: "Rajma with brown rice" }. */
function splitMeal(s: string): { label: string | null; text: string } {
  const m = s.match(MEAL_PREFIX);
  if (!m) return { label: null, text: s };
  const label = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return { label, text: s.slice(m[0].length) };
}

function usualFor(plan: RebalancePlan, d: CompensationDay): number {
  return plan.summary?.usual_calories ?? d.calorie_target - d.adjustment;
}

/** "ÖRZA says" — the plan's supportive message on the dark orb surface. */
export function OrzaSays({ message, className }: { message: string; className?: string }) {
  return (
    <OrbPanel as="section" aria-label="ÖRZA says" className={cn("p-5 sm:p-7", className)}>
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-orza-dot shadow-[0_0_12px_rgba(255,180,84,0.85)]" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">ÖRZA says</span>
      </div>
      <p className="mt-4 max-w-2xl pr-4 font-editorial text-[19px] leading-[1.5] text-white sm:pr-16 sm:text-[21px]">&ldquo;{message}&rdquo;</p>
      <p className="mt-5 text-[11px] text-white/45">Wellness guidance, not medical advice.</p>
    </OrbPanel>
  );
}

function DayCard({ plan, day, index }: { plan: RebalancePlan; day: CompensationDay; index: number }) {
  const usual = usualFor(plan, day);
  const trim = Math.max(0, -day.adjustment);
  return (
    <GlassCard variant="strong" className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Day {index + 1}</div>
          <div className="mt-1 text-[15px] font-semibold text-orza-strong">{formatDayDate(day.date)}</div>
        </div>
        {trim > 0 ? (
          <Tag tone="energy" size="sm">
            −{formatNumber(trim)} kcal
          </Tag>
        ) : (
          <Tag tone="success" size="sm">
            Usual calories
          </Tag>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-editorial text-[32px] font-semibold leading-none tracking-[-0.02em] text-orza-strong tabular-nums">{formatNumber(day.calorie_target)}</span>
        <span className="text-[13px] text-orza-subtle">kcal</span>
      </div>
      <div className="mt-1.5 text-[12px] text-orza-muted">
        {trim > 0 ? `A gentle trim from your usual ${formatNumber(usual)}` : `Same as your usual ${formatNumber(usual)}`}
      </div>
      <Bar value={day.calorie_target} max={usual} className="mt-3" />

      <dl className="mt-5 space-y-3.5 text-[14px]">
        <div className="flex gap-2.5">
          <dt className="mt-0.5 shrink-0 text-[#E0593F]">
            <Leaf size={16} strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Focus</span>
          </dt>
          <dd className="font-medium text-orza-strong">{day.focus}</dd>
        </div>
        <div className="flex gap-2.5">
          <dt className="mt-0.5 shrink-0 text-[#0B8FA6]">
            <Footprints size={16} strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Movement</span>
          </dt>
          <dd className="leading-relaxed text-orza-muted">{day.activity}</dd>
        </div>
      </dl>

      {day.meals.length > 0 && (
        <div className="mt-5 border-t border-[rgba(20,20,20,0.08)] pt-4">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
            <UtensilsCrossed size={13} strokeWidth={1.75} aria-hidden /> Meal ideas
          </div>
          <ul className="mt-3 space-y-2.5">
            {day.meals.map((m, i) => {
              const { label, text } = splitMeal(m);
              return (
                <li key={i} className="text-[13.5px] leading-snug">
                  {label && <span className="mb-0.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-orza-subtle">{label}</span>}
                  <span className="text-orza-strong">{text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}

/** Summary strip + "ÖRZA says" + one card per day. */
export function RebalancePlanView({
  plan,
  matched,
  showMessage = true,
  className,
}: {
  plan: RebalancePlan;
  /** Foods recognised when the surplus was estimated from the description. */
  matched?: string[];
  showMessage?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const s = plan.summary;
  const n = plan.days.length;
  const backTo = s?.back_to_usual;
  const trimTotal = s?.food_kcal ?? plan.days.reduce((a, d) => a + Math.max(0, -d.adjustment), 0);
  const avgTrim = s?.avg_daily_trim ?? (n ? Math.round(trimTotal / n / 10) * 10 : 0);

  const stats = [
    {
      k: "To rebalance",
      v: `${formatNumber(plan.extra_calories)} kcal`,
      note: plan.estimated ? "Estimated from what you ate" : "As you entered it",
      icon: <Flame size={15} strokeWidth={1.75} aria-hidden />,
    },
    {
      k: "Gentle trim",
      v: avgTrim > 0 ? `~${formatNumber(avgTrim)} kcal/day` : "None needed",
      note: `Over ${n} day${n === 1 ? "" : "s"}, no skipped meals`,
      icon: <Leaf size={15} strokeWidth={1.75} aria-hidden />,
    },
    {
      k: "Added movement",
      v: s && s.walk_minutes_per_day > 0 ? `${s.walk_minutes_per_day} min/day` : "Your usual",
      note: s && s.extra_steps_per_day > 0 ? `≈ ${formatNumber(s.extra_steps_per_day)} extra steps` : "An easy stroll is plenty",
      icon: <Footprints size={15} strokeWidth={1.75} aria-hidden />,
    },
    {
      k: "Back to usual",
      v: backTo ? formatDayDate(backTo) : `After day ${n}`,
      note: "Your regular targets resume",
      icon: <CalendarCheck size={15} strokeWidth={1.75} aria-hidden />,
    },
  ];

  return (
    <div className={className}>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((st) => (
          <div key={st.k} className="rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-white/60 px-4 py-3.5 backdrop-blur-orza">
            <dt className="flex items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-orza-subtle">
              {st.k}
              <span className="text-orza-muted">{st.icon}</span>
            </dt>
            <dd className="mt-2 text-[17px] font-semibold tabular-nums text-orza-strong sm:text-[19px]">{st.v}</dd>
            <dd className="mt-0.5 text-[12px] leading-snug text-orza-muted">{st.note}</dd>
          </div>
        ))}
      </dl>

      {plan.estimated && matched && matched.length > 0 && (
        <p className="mt-3 text-[12px] text-orza-subtle">Recognised: {matched.slice(0, 8).join(", ")}{matched.length > 8 ? "…" : ""}</p>
      )}

      {showMessage && <OrzaSays message={plan.message} className="mt-5" />}

      {s && s.released_kcal > 0 && (
        <p className="mt-4 text-[13px] leading-relaxed text-orza-muted">
          Trims stay within a gentle range (never below {formatNumber(s.floor_calories)} kcal a day) and walks stay comfortable, so the last ~
          {formatNumber(s.released_kcal)} kcal is simply left to even out naturally over the week.
        </p>
      )}

      <div className="mt-6">
        <Eyebrow>Your {n}-day plan</Eyebrow>
        <ol className={cn("mt-4 grid gap-4 sm:grid-cols-2", n >= 3 && "xl:grid-cols-3")}>
          {plan.days.map((d, i) => (
            <motion.li
              key={d.date}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.06 * i, ease: [0.16, 1, 0.3, 1] }}
              className="h-full"
            >
              <DayCard plan={plan} day={d} index={i} />
            </motion.li>
          ))}
        </ol>
      </div>
    </div>
  );
}
