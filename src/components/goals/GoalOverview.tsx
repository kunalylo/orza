"use client";
import * as React from "react";
import { ArrowRight, CalendarDays, Gauge, Target } from "lucide-react";
import type { Goal } from "@/lib/types";
import { clamp, cn } from "@/lib/utils";
import { EnergyRing, Eyebrow, GlassCard, IconTile, Tag, type TagTone } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { GOAL_LABEL, daysBetween, formatKg, formatLongDate, formatShortDate } from "@/components/goals/goal-math";

type Status = { tone: TagTone; label: string; note: string };

/** Gentle, judgment-free read on progress vs the planned pace. */
function statusFor(goal: Goal, latest: number, today: string, pct: number): Status {
  const since = goal.created_at.slice(0, 10);
  const weeks = Math.max(0, daysBetween(since, today) / 7);
  if (goal.goal === "maintain") {
    const diff = Math.abs(latest - goal.target_weight_kg);
    return diff <= 1
      ? { tone: "success", label: "Holding steady", note: "You're right in your comfort zone. Keep your everyday rhythm going." }
      : { tone: "info", label: "Small drift", note: "A kilo or two either way is normal — ÖRZA will nudge your daily targets gently." };
  }
  if (pct >= 1) return { tone: "success", label: "Target reached", note: "You made it. Celebrate — then consider a maintain goal to hold your progress." };
  if (weeks < 1) return { tone: "neutral", label: "Just getting started", note: "Weigh in once or twice a week, same time of day, for the clearest trend." };
  const expected = goal.weekly_rate_kg * weeks; // signed
  const actual = latest - goal.current_weight_kg;
  const ahead = goal.goal === "lose" ? actual <= expected - 0.3 : actual >= expected + 0.3;
  const onTrack = Math.abs(actual - expected) <= 0.6;
  if (ahead) return { tone: "success", label: "Ahead of plan", note: "Lovely momentum. Make sure you're still eating enough to feel energised." };
  if (onTrack) return { tone: "success", label: "On track", note: "Right where your plan expects you to be. Consistency is doing its job." };
  return { tone: "info", label: "Taking its time", note: "Bodies aren't linear — water, sleep and stress all play a part. Keep going; the trend matters more than any single day." };
}

export function progressFor(goal: Goal, latest: number): number {
  if (goal.goal === "maintain") {
    const diff = Math.abs(latest - goal.target_weight_kg);
    return diff <= 1 ? 1 : clamp(1 - (diff - 1) / 3, 0, 1);
  }
  const total = goal.target_weight_kg - goal.current_weight_kg;
  if (!total) return 1;
  return clamp((latest - goal.current_weight_kg) / total, 0, 1);
}

export function GoalOverview({ goal, latest, today, onPlan }: { goal: Goal | null; latest: number | null; today: string; onPlan: () => void }) {
  if (!goal) {
    return (
      <GlassCard variant="strong" className="relative flex h-full flex-col justify-between overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -right-24 h-[340px] w-[340px] rounded-full"
          style={{ background: "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.32) 0%, rgba(255,95,162,0.12) 40%, rgba(0,0,0,0) 70%)", filter: "blur(10px)" }}
        />
        <div className="relative">
          <IconTile tone="energy">
            <Target size={18} strokeWidth={1.75} />
          </IconTile>
          <Eyebrow className="mt-5">Smart goals</Eyebrow>
          <h2 className="mt-2 font-editorial text-[26px] font-semibold leading-[32px] tracking-[-0.01em] text-orza-strong">Set a goal that fits your life.</h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-orza-muted">
            Set targets and get intelligent recommendations. AI-powered planning adapts to your lifestyle and progress — at a pace that stays safe and kind.
          </p>
        </div>
        <div className="relative mt-8">
          <Button onClick={onPlan} size="lg">
            Plan my goal <ArrowRight size={15} strokeWidth={1.75} />
          </Button>
        </div>
      </GlassCard>
    );
  }

  const now = latest ?? goal.current_weight_kg;
  const pct = progressFor(goal, now);
  const status = statusFor(goal, now, today, pct);
  const change = Math.round((now - goal.current_weight_kg) * 10) / 10;
  const pace = Math.abs(goal.weekly_rate_kg);

  return (
    <GlassCard variant="strong" className="relative h-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Active goal</Eyebrow>
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone="energy" size="sm">
            {GOAL_LABEL[goal.goal]}
          </Tag>
          <Tag tone={status.tone} size="sm">
            {status.label}
          </Tag>
        </div>
      </div>

      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex justify-center">
          <EnergyRing value={pct * 100} max={100} size={176} stroke={11} id="goal-progress-ring">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{goal.goal === "maintain" ? "Stability" : "Progress"}</span>
            <span className="mt-1 font-editorial text-[44px] font-semibold leading-none tracking-[-0.03em] text-orza-strong">{Math.round(pct * 100)}%</span>
            <span className="mt-1 text-[12px] text-orza-muted">{goal.goal === "maintain" ? "in range" : "of the way"}</span>
          </EnergyRing>
        </div>

        <div>
          <dl className="grid grid-cols-3 gap-2">
            {[
              { k: "Start", v: formatKg(goal.current_weight_kg) },
              { k: "Now", v: formatKg(now), strong: true },
              { k: goal.goal === "maintain" ? "Keep near" : "Target", v: formatKg(goal.target_weight_kg) },
            ].map((s) => (
              <div key={s.k} className={cn("rounded-orza-sm border px-3 py-2.5", s.strong ? "border-[rgba(255,122,106,0.28)] bg-[#FFF6F1]" : "border-[rgba(20,20,20,0.08)] bg-white/60")}>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{s.k}</dt>
                <dd className="mt-1 text-[15px] font-semibold tabular-nums text-orza-strong">{s.v}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 space-y-2.5 text-[14px]">
            <li className="flex items-center gap-2.5 text-orza-muted">
              <Gauge size={16} strokeWidth={1.75} className="shrink-0 text-[#E0593F]" />
              {goal.goal === "maintain" ? (
                <span>Maintenance pace — no deficit, no surplus</span>
              ) : (
                <span>
                  <span className="font-medium text-orza-strong">
                    {goal.goal === "lose" ? "−" : "+"}
                    {pace} kg
                  </span>{" "}
                  a week planned
                  {change !== 0 && (
                    <span className="text-orza-subtle">
                      {" "}
                      · {change > 0 ? "+" : "−"}
                      {Math.abs(change)} kg so far
                    </span>
                  )}
                </span>
              )}
            </li>
            <li className="flex items-center gap-2.5 text-orza-muted">
              <CalendarDays size={16} strokeWidth={1.75} className="shrink-0 text-[#E0593F]" />
              {goal.target_date ? (
                <span>
                  Estimated around <span className="font-medium text-orza-strong">{formatLongDate(goal.target_date)}</span>
                </span>
              ) : (
                <span>Set on {formatShortDate(goal.created_at.slice(0, 10))} · no finish line needed</span>
              )}
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-5 rounded-orza-sm border border-[rgba(20,20,20,0.06)] bg-white/50 px-4 py-3 text-[13px] leading-relaxed text-orza-muted">{status.note}</p>
    </GlassCard>
  );
}
