import * as React from "react";
import { Droplets, Footprints, Wheat } from "lucide-react";
import { Eyebrow } from "@/components/orza/primitives";
import { WellnessNote } from "@/components/app/ui";
import type { PlanSummary } from "@/lib/onboarding";
import { formatNumber } from "@/lib/utils";

/** The summary step, rendered as a plan card: daily energy + macros, hydration, steps, and what it's based on. */
export function SummaryCard({ summary, name }: { summary: PlanSummary; name?: string }) {
  const t = summary.targets;
  const first = (name || "").trim().split(/\s+/)[0];
  const macros = [
    { label: "Protein", value: t.protein_g, unit: "g", dot: "bg-orza-coral" },
    { label: "Carbs", value: t.carbs_g, unit: "g", dot: "bg-orza-amber" },
    { label: "Fat", value: t.fat_g, unit: "g", dot: "bg-orza-pink" },
  ];
  const extras = [
    { icon: Droplets, label: "Water", value: `${t.water_glasses} glasses` },
    { icon: Footprints, label: "Steps", value: formatNumber(t.steps) },
    { icon: Wheat, label: "Fibre", value: `${t.fiber_g} g` },
  ];

  return (
    <div className="relative w-full max-w-[560px] overflow-hidden rounded-[22px] rounded-tl-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.80)] shadow-orza-glass backdrop-blur-orza">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,180,84,0.30) 0%, rgba(255,122,106,0.14) 40%, rgba(255,255,255,0) 70%)" }}
      />
      <div className="relative p-5 sm:p-6">
        <Eyebrow>{first ? `${first}'s starting plan` : "Your starting plan"}</Eyebrow>

        <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="font-editorial text-[44px] font-semibold leading-none tracking-[-0.02em] text-orza-strong tabular-nums sm:text-[52px]">
            {formatNumber(t.calories)}
          </span>
          <span className="pb-1.5 text-[14px] text-orza-muted">kcal a day</span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-orza-muted">{summary.goal_line}</p>

        <dl className="mt-5 grid grid-cols-3 gap-2">
          {macros.map((m) => (
            <div key={m.label} className="min-w-0 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/70 px-2.5 py-2.5 sm:px-3">
              <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-orza-subtle sm:tracking-[0.14em]">
                <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden />
                {m.label}
              </dt>
              <dd className="mt-1 text-[18px] font-semibold text-orza-strong tabular-nums">
                {m.value}
                <span className="ml-0.5 text-[13px] font-normal text-orza-subtle">{m.unit}</span>
              </dd>
            </div>
          ))}
        </dl>

        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {extras.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon size={14} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />
              <dt className="text-orza-subtle">{label}</dt>
              <dd className="font-medium text-orza-strong tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {summary.facts.length > 0 && (
          <div className="mt-5 border-t border-[rgba(20,20,20,0.08)] pt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Based on</div>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {summary.facts.map((f) => (
                <li key={f.label} className="rounded-full border border-[rgba(20,20,20,0.10)] bg-white/75 px-2.5 py-1 text-[12px] text-orza-muted">
                  <span className="text-orza-subtle">{f.label}:</span> <span className="text-orza-strong">{f.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-5 text-[14px] leading-relaxed text-orza-strong">
          These are gentle starting points — you can fine-tune them anytime in Settings. Shall I save this?
        </p>
        <WellnessNote className="mt-2" />
      </div>
    </div>
  );
}
