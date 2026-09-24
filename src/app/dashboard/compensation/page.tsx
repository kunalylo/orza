"use client";
import * as React from "react";
import { CalendarCheck, CircleAlert, Footprints, Leaf, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useUser } from "@/components/app/UserProvider";
import { PageHeader, WellnessNote } from "@/components/app/ui";
import { Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Button } from "@/components/ui/button";
import { OrbPanel } from "@/components/goals/OrbPanel";
import { RebalanceForm } from "@/components/goals/RebalanceForm";
import { RebalanceHistory } from "@/components/goals/RebalanceHistory";
import { RebalancePlanView } from "@/components/goals/RebalancePlanView";
import { formatDayDate } from "@/components/goals/goal-math";
import type { RebalanceCreateResponse, RebalanceListResponse, RebalancePlan } from "@/components/goals/types";

const PRINCIPLES = [
  {
    icon: Leaf,
    title: "Gentle trims, never starving",
    body: "At most 15% off your usual calories on any day — and never below a safe floor for your body.",
  },
  {
    icon: Footprints,
    title: "A little extra movement",
    body: "An easy walk, a dance session or the stairs — something you enjoy, never a punishment.",
  },
  {
    icon: CalendarCheck,
    title: "Back to your rhythm in 2–5 days",
    body: "No skipped meals, no detoxes, no guilt. Just steady, kind choices.",
  },
];

const CHIP_OCCASION = /^(wedding|birthday|festival|party|vacation)$/i;

/** "After the wedding" / "After my birthday" / the occasion as typed. */
function resultTitle(occasion: string): string {
  const o = occasion.trim();
  if (CHIP_OCCASION.test(o)) return `After the ${o.toLowerCase()}`;
  if (/^(the|my|our|a|an|your)\s/i.test(o)) return `After ${o.charAt(0).toLowerCase()}${o.slice(1)}`;
  return o;
}

function HowItWorks() {
  return (
    <OrbPanel orb="bottom-right" className="p-5 sm:p-7">
      <Eyebrow tone="dark">How ÖRZA rebalances</Eyebrow>
      <p className="mt-3 font-editorial text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-white sm:text-[26px]">One meal is never the whole story.</p>
      <ul className="mt-6 space-y-5">
        {PRINCIPLES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#FFB454]" aria-hidden>
              <Icon size={16} strokeWidth={1.75} />
            </span>
            <span>
              <span className="block text-[15px] font-medium text-white">{title}</span>
              <span className="mt-1 block text-[13.5px] leading-relaxed text-white/65">{body}</span>
            </span>
          </li>
        ))}
      </ul>
    </OrbPanel>
  );
}

/** Compassionate Rebalancing — a supportive 2–5 day plan after a special meal, plus past plans. */
export default function CompensationPage() {
  const { setCredits } = useUser();
  const [plans, setPlans] = React.useState<RebalancePlan[]>([]);
  const [meta, setMeta] = React.useState<{ ai_enabled?: boolean; cost?: number }>({});
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<RebalanceCreateResponse | null>(null);
  const resultRef = React.useRef<HTMLElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<RebalanceListResponse>("/compensation");
      setPlans(res.plans || []);
      setMeta({ ai_enabled: res.ai_enabled, cost: res.cost });
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Bring a fresh plan into view once it has rendered.
  const resultId = result?.plan.id;
  React.useEffect(() => {
    if (resultId) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resultId]);

  const onCreated = (res: RebalanceCreateResponse) => {
    setResult(res);
    setPlans((p) => [res.plan, ...p.filter((x) => x.id !== res.plan.id)].slice(0, 20));
    if (typeof res.credits === "number") setCredits(res.credits);
    if (res.notice) toast(res.notice);
    else toast.success("Your rebalance plan is ready.");
  };

  const onDeleted = (id: string) => {
    setPlans((p) => p.filter((x) => x.id !== id));
    setResult((r) => (r?.plan.id === id ? null : r));
  };

  const plan = result?.plan;
  const n = plan?.days.length ?? 0;

  return (
    <div ref={topRef} className="scroll-mt-24">
      <PageHeader
        eyebrow="Compassionate rebalancing"
        title="Rebalance"
        description="Enjoyed a special meal? ÖRZA creates a supportive recovery plan — no guilt, just smart wellness strategies."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1.35fr_1fr] lg:gap-6">
        <Reveal y={10}>
          <RebalanceForm aiEnabled={loading ? undefined : meta.ai_enabled} cost={meta.cost} onCreated={onCreated} />
        </Reveal>
        <Reveal y={10} delay={0.06}>
          <HowItWorks />
        </Reveal>
      </div>

      {plan && (
        <section ref={resultRef} className="mt-10 scroll-mt-24 lg:mt-12" aria-labelledby="rebalance-result-title">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>Your rebalance plan</Eyebrow>
              <h2 id="rebalance-result-title" className="mt-2 font-editorial text-[26px] font-semibold leading-[32px] tracking-[-0.01em] text-orza-strong sm:text-[30px] sm:leading-[38px]">
                {resultTitle(plan.occasion)}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Tag tone={plan.ai ? "violet" : "neutral"} size="sm">
                  {plan.ai ? "AI-personalised" : "Built-in plan"}
                </Tag>
                {n > 0 && (
                  <span className="text-[13px] text-orza-muted">
                    {n} days · starts {formatDayDate(plan.days[0].date)}
                  </span>
                )}
              </div>
            </div>
            <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Plan another
            </Button>
          </div>
          <RebalancePlanView plan={plan} matched={result?.estimate?.matched} />
          <WellnessNote className="mt-5" />
        </section>
      )}

      <section className="mt-12 lg:mt-14" aria-labelledby="rebalance-history-title">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <Eyebrow>History</Eyebrow>
            <h2 id="rebalance-history-title" className="mt-2 font-editorial text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-orza-strong sm:text-[26px]">
              Past plans
            </h2>
          </div>
          {!loading && !loadError && plans.length > 0 && (
            <span className="pb-1 text-[13px] text-orza-muted">
              {plans.length} plan{plans.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {loadError ? (
          <GlassCard variant="strong" className="flex flex-col items-center px-6 py-10 text-center" role="alert">
            <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#FDECEC] text-[#B02C2C]">
              <CircleAlert size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="font-editorial text-lg font-semibold text-orza-strong">We couldn&rsquo;t load your past plans</div>
            <p className="mt-1.5 max-w-sm text-sm text-orza-muted">{loadError}</p>
            <Button className="mt-5" variant="secondary" onClick={load}>
              <RotateCw size={15} strokeWidth={1.75} aria-hidden /> Try again
            </Button>
          </GlassCard>
        ) : (
          <RebalanceHistory plans={plans} loading={loading} highlightId={result?.plan.id} onDeleted={onDeleted} />
        )}
      </section>

      <WellnessNote className="mt-8 text-center" />
    </div>
  );
}
