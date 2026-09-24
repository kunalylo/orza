"use client";
import * as React from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { Globe, Languages, ShieldCheck, Timer, type LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { GlassCard, Section } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";

type Stat = {
  icon: LucideIcon;
  prefix?: string;
  value: number;
  suffix?: string;
  count: boolean; // animate 0 → value when scrolled into view
  label: string;
};

const STATS: Stat[] = [
  { icon: Globe, value: 10000, suffix: "+", count: true, label: "Global Dishes Recognized" },
  { icon: Languages, value: 50, suffix: "+", count: true, label: "Languages Supported" },
  { icon: Timer, prefix: "< ", value: 3, suffix: "s", count: false, label: "AI Analysis Time" },
  { icon: ShieldCheck, value: 100, suffix: "%", count: true, label: "Privacy Focused" },
];

/**
 * Counts up once the numeral scrolls into view. The server (and no-JS / reduced-motion
 * visitors) always get the real number; the reset to 0 only happens after hydration.
 */
function useCountUp(target: number, enabled: boolean) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [value, setValue] = React.useState(target);
  const armed = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || reduce || inView || armed.current) return;
    armed.current = true;
    setValue(0);
  }, [enabled, reduce, inView]);

  React.useEffect(() => {
    if (!enabled || !inView) return;
    if (reduce || !armed.current) {
      setValue(target);
      return;
    }
    const controls = animate(0, target, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [enabled, reduce, inView, target]);

  return { ref, value };
}

function StatTile({ stat, index }: { stat: Stat; index: number }) {
  const { ref, value } = useCountUp(stat.value, stat.count);
  const Icon = stat.icon;
  const finalText = `${stat.prefix ?? ""}${formatNumber(stat.value)}${stat.suffix ?? ""}`;

  return (
    <GlassCard padded={false} className="relative h-full overflow-hidden p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-[0.14em] text-orza-subtle">{String(index + 1).padStart(2, "0")}</span>
        <Icon size={16} strokeWidth={1.75} className="text-orza-muted" aria-hidden />
      </div>
      <p className="mt-6 whitespace-nowrap font-editorial text-[32px] font-semibold leading-none tracking-[-0.03em] text-orza-strong sm:text-[44px] lg:text-[48px]">
        <span ref={ref} aria-hidden className="tabular-nums">
          {stat.prefix && <span className="orza-energy-text">{stat.prefix}</span>}
          {formatNumber(value)}
          {stat.suffix && <span className="orza-energy-text">{stat.suffix}</span>}
        </span>
        <span className="sr-only">{finalText}</span>
      </p>
      <p className="mt-3 text-sm text-orza-muted">{stat.label}</p>
      <span aria-hidden className="absolute bottom-0 left-5 h-[2px] w-10 rounded-full bg-orza-energy opacity-70 sm:left-6" />
    </GlassCard>
  );
}

export function HomeStats() {
  return (
    <Section tone="canvas" aria-labelledby="home-stats-title" className="py-10 md:py-14 lg:py-16">
      <h2 id="home-stats-title" className="sr-only">
        ÖRZA at a glance
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal as="li" key={s.label} delay={i * 0.06} className="h-full">
            <StatTile stat={s} index={i} />
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
