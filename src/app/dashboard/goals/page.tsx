"use client";
import * as React from "react";
import Link from "next/link";
import { CircleAlert, RotateCw, SlidersHorizontal, Target } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { dateInTz, DEFAULT_TZ } from "@/lib/dates";
import type { PublicUser, Targets, TrackingDay } from "@/lib/types";
import { useUser } from "@/components/app/UserProvider";
import { PageHeader, WellnessNote } from "@/components/app/ui";
import { Eyebrow, GlassCard } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { GoalCalculator } from "@/components/goals/GoalCalculator";
import { GoalOverview } from "@/components/goals/GoalOverview";
import { TargetsGrid } from "@/components/goals/TargetsGrid";
import { WeightTrendCard } from "@/components/goals/WeightTrendCard";
import { formatLongDate } from "@/components/goals/goal-math";
import type { GoalCalculateResponse, GoalsActiveResponse, WeightPoint } from "@/components/goals/types";

/** Insert or replace one day's weigh-in, keeping the list ascending. */
function upsertWeight(points: WeightPoint[], date: string, weight_kg: number): WeightPoint[] {
  return [...points.filter((p) => p.date !== date), { date, weight_kg }].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function GoalsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your goals">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
        <Skeleton className="h-[340px] rounded-orza-md" />
        <Skeleton className="h-[340px] rounded-orza-md" />
      </div>
      <Skeleton className="mt-10 h-4 w-32 rounded-full" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-orza-md" />
        ))}
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
        <Skeleton className="h-[480px] rounded-orza-md" />
        <Skeleton className="h-[420px] rounded-orza-lg" />
      </div>
    </div>
  );
}

function SectionTitle({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="mt-2 font-editorial text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-orza-strong sm:text-[26px]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

/** Smart Goals — active goal progress, weight trend, daily targets and the goal planner. */
export default function GoalsPage() {
  const { user, setUser } = useUser();
  const [data, setData] = React.useState<GoalsActiveResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [previousTargets, setPreviousTargets] = React.useState<Targets | null>(null);
  const [plannerKey, setPlannerKey] = React.useState(0);
  const plannerRef = React.useRef<HTMLElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      setData(await api.get<GoalsActiveResponse>("/goals/active"));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const today = data?.today ?? dateInTz(user.profile?.timezone || DEFAULT_TZ);
  const latest = data?.weights.length ? data.weights[data.weights.length - 1].weight_kg : (data?.profile.weight_kg ?? null);

  const scrollToPlanner = () => plannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const onWeightLogged = React.useCallback(
    (weightKg: number, tracking?: TrackingDay, u?: PublicUser) => {
      const date = tracking?.date || today;
      setData((d) => (d ? { ...d, weights: upsertWeight(d.weights, date, weightKg), profile: u ? u.profile : d.profile } : d));
      if (u) setUser(u);
    },
    [today, setUser]
  );

  const onGoalSaved = React.useCallback(
    (res: GoalCalculateResponse) => {
      setPreviousTargets(data?.targets ?? null);
      setData((d) =>
        d
          ? {
              ...d,
              goal: res.goal,
              targets: res.user.targets,
              profile: res.user.profile,
              weights: upsertWeight(d.weights, today, res.goal.current_weight_kg),
            }
          : d
      );
      setUser(res.user);
      setPlannerKey((k) => k + 1);
      toast.success(
        res.goal.target_date ? `Goal saved — estimated around ${formatLongDate(res.goal.target_date)}. Your daily targets are updated.` : "Goal saved — your daily targets are updated."
      );
      if (res.notice) toast(res.notice);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [data?.targets, today, setUser]
  );

  return (
    <div ref={topRef} className="scroll-mt-24">
      <PageHeader
        eyebrow="Smart goals"
        title="Goals & planner"
        description="Set targets and get intelligent recommendations. AI-powered planning adapts to your lifestyle and progress."
        actions={
          data && !error ? (
            <Button variant="secondary" onClick={scrollToPlanner}>
              <Target size={15} strokeWidth={1.75} aria-hidden /> {data.goal ? "Update goal" : "Set a goal"}
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <GlassCard variant="strong" className="flex flex-col items-center px-6 py-12 text-center" role="alert">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#FDECEC] text-[#B02C2C]">
            <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="font-editorial text-lg font-semibold text-orza-strong">We couldn&rsquo;t load your goals</div>
          <p className="mt-1.5 max-w-sm text-sm text-orza-muted">{error}</p>
          <Button className="mt-5" onClick={load}>
            <RotateCw size={15} strokeWidth={1.75} aria-hidden /> Try again
          </Button>
        </GlassCard>
      ) : !data ? (
        <GoalsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
            <Reveal y={10} className="h-full">
              <GoalOverview goal={data.goal} latest={latest} today={today} onPlan={scrollToPlanner} />
            </Reveal>
            <Reveal y={10} delay={0.06} className="h-full">
              <WeightTrendCard points={data.weights} target={data.goal && data.goal.goal !== "maintain" ? data.goal.target_weight_kg : null} onLogged={onWeightLogged} />
            </Reveal>
          </div>

          <section className="mt-10 lg:mt-12" aria-labelledby="daily-targets-title">
            <SectionTitle id="daily-targets-title" eyebrow="Daily targets" title={data.goal ? "What your goal looks like each day" : "Your daily targets"}>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-orza-muted underline-offset-4 transition-colors hover:text-orza-strong hover:underline sm:self-auto"
              >
                <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden /> Fine-tune in Settings
              </Link>
            </SectionTitle>
            <TargetsGrid targets={data.targets} previous={previousTargets} />
          </section>

          <section ref={plannerRef} className="mt-10 scroll-mt-24 lg:mt-12" aria-labelledby="goal-planner-title">
            <div className="mb-5">
              <Eyebrow>Goal planner</Eyebrow>
              <h2 id="goal-planner-title" className="mt-2 font-editorial text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-orza-strong sm:text-[26px]">
                {data.goal ? "Adjust your goal" : "Plan a goal that fits your life"}
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-orza-muted">
                Choose a pace that feels sustainable. ÖRZA works out your calories and macros instantly, and keeps every plan within safe limits.
              </p>
            </div>
            <GoalCalculator
              key={plannerKey}
              goal={data.goal}
              profile={data.profile}
              latestWeight={latest}
              currentTargets={data.targets}
              today={today}
              onSaved={onGoalSaved}
            />
          </section>

          <WellnessNote className="mt-8 text-center" />
        </>
      )}
    </div>
  );
}
