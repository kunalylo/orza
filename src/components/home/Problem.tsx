import { ArrowDownToDot, Check, X, Zap } from "lucide-react";
import { GlassCard, IconTile, Section, SectionHeader } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";

const TYPICAL = [
  "Generic food databases that fail on home-cooked meals",
  "No understanding of Indian cuisines or regional dishes",
  "Manual logging feels like tedious homework",
  "Built for individuals, ignoring households",
  "No AI assistance, just data entry",
  "Can’t understand voice or camera input naturally",
];

const SOLUTION = [
  "AI that understands “poha”, “thali”, “katori dal” naturally",
  "Deep knowledge of state-wise dishes and cooking styles",
  "Camera scans + voice logging in Hindi/English/Hinglish",
  "Built for couples, caregivers, and families",
  "Conversational AI that learns your lifestyle",
  "Phone and wearable sync for effortless tracking",
];

export function HomeProblem() {
  return (
    <Section id="problem" tone="raised">
      <Reveal>
        <SectionHeader
          eyebrow="The Problem"
          title={
            <>
              Health apps are <em className="orza-energy-text pr-[0.06em] italic">broken</em>
            </>
          }
          lead="Most wellness apps fail where real life happens — home-cooked meals, family coordination, and cultural understanding."
        />
      </Reveal>

      <div className="mt-10 grid gap-4 md:mt-12 md:grid-cols-2 md:gap-6">
        {/* Typical apps — muted */}
        <Reveal className="h-full">
          <GlassCard variant="subtle" padded={false} className="h-full p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <IconTile className="h-9 w-9 bg-white/50 text-orza-subtle">
                <X size={16} strokeWidth={1.75} aria-hidden />
              </IconTile>
              <h3 className="font-editorial text-xl font-semibold tracking-[-0.01em] text-orza-muted sm:text-2xl">Typical Apps</h3>
            </div>
            <ul className="mt-5 divide-y divide-[rgba(20,20,20,0.07)] border-t border-[rgba(20,20,20,0.07)]">
              {TYPICAL.map((t) => (
                <li key={t} className="flex items-start gap-3 py-3.5 text-[15px] leading-6 text-orza-muted">
                  <span className="mt-[3px] inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white/40">
                    <X size={11} strokeWidth={2} className="text-orza-subtle" aria-hidden />
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </Reveal>

        {/* ÖRZA — highlighted with the energy accent */}
        <Reveal delay={0.08} className="h-full">
          <GlassCard
            variant="strong"
            padded={false}
            className="relative h-full overflow-hidden border-[rgba(255,122,106,0.28)] p-5 shadow-orza-glass-hover sm:p-7"
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-orza-energy" />
            <span
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,180,84,0.22) 0%, rgba(255,122,106,0.08) 45%, rgba(255,95,162,0) 70%)",
                filter: "blur(6px)",
              }}
            />
            <div className="relative flex items-center gap-3">
              <IconTile tone="energy" className="h-9 w-9">
                <Zap size={16} strokeWidth={1.75} aria-hidden />
              </IconTile>
              <h3 className="font-editorial text-xl font-semibold tracking-[-0.01em] text-orza-strong sm:text-2xl">
                ÖRZA&rsquo;s Solution
              </h3>
            </div>
            <ul className="relative mt-5 divide-y divide-[rgba(20,20,20,0.07)] border-t border-[rgba(20,20,20,0.07)]">
              {SOLUTION.map((s) => (
                <li key={s} className="flex items-start gap-3 py-3.5 text-[15px] font-medium leading-6 text-orza-strong">
                  <span className="mt-[3px] inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-orza-energy text-white shadow-[0_4px_12px_rgba(255,122,106,0.35)]">
                    <Check size={11} strokeWidth={2.5} aria-hidden />
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </Reveal>
      </div>

      {/* Converge */}
      <Reveal className="mt-10 flex flex-col items-center gap-4 md:mt-12">
        <ArrowDownToDot size={22} strokeWidth={1.5} className="text-orza-subtle" aria-hidden />
        <GlassCard variant="strong" className="relative w-full max-w-2xl overflow-hidden px-6 py-9 text-center sm:px-10 sm:py-10">
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-28 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full"
            style={{ background: "radial-gradient(ellipse, rgba(255,180,84,0.18) 0%, rgba(255,95,162,0.06) 50%, rgba(0,0,0,0) 72%)" }}
          />
          <IconTile tone="energy" className="relative mx-auto">
            <Zap size={18} strokeWidth={1.75} aria-hidden />
          </IconTile>
          <h3 className="relative mt-4 font-editorial text-2xl font-semibold tracking-[-0.02em] text-orza-strong sm:text-3xl">
            Built for real life, not spreadsheets
          </h3>
          <p className="relative mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-orza-muted">
            ÖRZA combines AI intelligence with cultural sensitivity to deliver a wellness experience that actually understands
            your life.
          </p>
        </GlassCard>
      </Reveal>
    </Section>
  );
}
