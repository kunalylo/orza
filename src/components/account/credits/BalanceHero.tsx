"use client";
import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";
import { ArrowDown, Cpu, MessageSquarePlus, Sparkles } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import type { CreditCosts } from "@/components/account/types";
import { cn, formatNumber } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Counts up to `value` (and between later values); jumps straight there with reduced motion. */
function useCountUp(value: number) {
  const reduce = useReducedMotion();
  const [shown, setShown] = React.useState(reduce ? value : 0);
  const from = React.useRef(reduce ? value : 0);
  React.useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, { duration: 1.1, ease: EASE, onUpdate: (v) => setShown(Math.round(v)) });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return shown;
}

/**
 * Dark hero card with the glowing amber → coral → pink orb and the balance as a large editorial numeral.
 */
export function BalanceHero({
  credits,
  costs,
  aiEnabled,
  spent30d,
  requested,
  onRequest,
}: {
  credits: number;
  costs: CreditCosts;
  aiEnabled: boolean;
  spent30d?: number;
  requested: boolean;
  onRequest: () => void;
}) {
  const shown = useCountUp(credits);
  const scans = Math.floor(credits / Math.max(1, costs.scan));
  const chats = Math.floor(credits / Math.max(1, costs.chat));
  const low = aiEnabled && credits < 10;

  return (
    <section
      aria-labelledby="credits-balance-title"
      className="relative isolate h-full overflow-hidden rounded-orza-xl bg-orza-hero p-6 text-[var(--orza-hero-text)] shadow-orza-floating sm:p-8"
    >
      {/* Washes: cyan top-left, violet bottom-left, warm behind the orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 12% 8%, rgba(47,210,240,0.12) 0%, rgba(7,9,12,0) 50%)," +
            "radial-gradient(ellipse at 8% 100%, rgba(191,168,255,0.10) 0%, rgba(7,9,12,0) 55%)," +
            "radial-gradient(ellipse at 85% 30%, rgba(255,180,84,0.14) 0%, rgba(7,9,12,0) 55%)",
        }}
      />
      <div aria-hidden className="orza-hero-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />

      {/* Glowing energy orb */}
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-12 h-[240px] w-[240px] opacity-70 sm:-right-6 sm:top-6 sm:h-[260px] sm:w-[260px] sm:opacity-100">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,180,84,0.40) 0%, rgba(255,122,106,0.20) 40%, rgba(255,95,162,0.06) 62%, rgba(7,9,12,0) 72%)",
            filter: "blur(18px)",
          }}
        />
        <div
          className="absolute inset-[26%] animate-orza-pulse rounded-full"
          style={{
            background: "radial-gradient(circle at 36% 32%, #FFF6EA 0%, #FFE7C8 14%, #FFB454 40%, #FF7A6A 68%, #FF5FA2 100%)",
            boxShadow: "0 0 60px rgba(255,122,106,0.55), 0 0 120px rgba(255,95,162,0.25)",
          }}
        />
        <div className="absolute inset-[14%] animate-orza-spin-slow rounded-full border border-dashed border-white/10" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-orza">
            <Sparkles size={12} strokeWidth={1.75} className="text-orza-amber" aria-hidden />
            AI credits · Free plan
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium",
              aiEnabled ? "border-[rgba(95,211,164,0.35)] bg-[rgba(95,211,164,0.12)] text-[#8FE6C2]" : "border-white/15 bg-white/[0.06] text-white/75"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {aiEnabled ? "AI is on" : "Built-in engine · free"}
          </span>
        </div>

        <h2 id="credits-balance-title" className="sr-only">
          Your credit balance
        </h2>
        <div className="mt-8 sm:mt-10">
          <div
            className="orza-energy-text font-editorial text-[72px] font-semibold leading-[0.95] tracking-[-0.04em] tabular-nums sm:text-[96px]"
            aria-live="polite"
            aria-label={`${formatNumber(credits)} credits available`}
          >
            {formatNumber(shown)}
          </div>
          <div className="mt-2 text-[15px] text-white/75">credits available</div>
        </div>

        <p className="mt-5 max-w-md text-[14px] leading-relaxed text-white/65">
          {aiEnabled ? (
            credits > 0 ? (
              <>
                Enough for about <span className="text-white/90">{formatNumber(scans)} meal scans</span> or{" "}
                <span className="text-white/90">{formatNumber(chats)} chat messages</span>.
                {low && " You're running low — request more below and we'll top you up."}
              </>
            ) : (
              "You've used all your AI credits. Manual logging keeps working for free — request more and we'll top you up."
            )
          ) : (
            "ÖRZA's built-in engine is handling meal logging, chat, recipes and plans for free right now. Your credits stay untouched."
          )}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 sm:max-w-md">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Used · last 30 days</dt>
            <dd className="mt-1 font-editorial text-[22px] font-semibold tabular-nums text-white">{spent30d == null ? "—" : formatNumber(spent30d)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">Manual logging</dt>
            <dd className="mt-1 flex items-center gap-1.5 font-editorial text-[22px] font-semibold text-white">
              <Cpu size={16} strokeWidth={1.75} className="text-orza-cyan-300" aria-hidden /> Free
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap gap-2.5 pt-7">
          <Button variant="hero" size="lg" onClick={onRequest} disabled={requested} className="px-5">
            <MessageSquarePlus size={16} strokeWidth={1.75} aria-hidden />
            {requested ? "Request sent" : "Request more credits"}
          </Button>
          <ButtonLink href="#costs" variant="hero-outline" size="lg" className="px-5">
            What costs credits <ArrowDown size={15} strokeWidth={1.75} aria-hidden />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
