"use client";
import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, ChevronDown, Footprints, Scale, Sparkles, Utensils, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/orza/primitives";
import { ButtonLink } from "@/components/ui/button";
import { HeroScene } from "./_heroScene";

const EASE = [0.16, 1, 0.3, 1] as const;

const LINE_ONE = ["Your", "health,"];
const LINE_TWO = ["by", "AI", "that", "evolves", "with", "you"];

/** Floating glass stat chips. On phones they sit in a row under the orb; from `sm` they float around it. */
const CHIPS: { icon: LucideIcon; value: string; label: string; iconClass: string; place: string; delay: string }[] = [
  {
    icon: Utensils,
    value: "450 kcal",
    label: "Paneer Tikka",
    iconClass: "text-orza-amber",
    place: "sm:left-[-3%] sm:top-[2%]",
    delay: "0s",
  },
  {
    icon: Scale,
    value: "2.5 kg",
    label: "Lost This Month",
    iconClass: "text-orza-cyan-300",
    place: "sm:right-[-6%] sm:bottom-[-1%]",
    delay: "-2s",
  },
  {
    icon: Footprints,
    value: "8,245",
    label: "Steps Today",
    iconClass: "text-orza-violet-300",
    place: "sm:left-[0%] sm:bottom-[1%]",
    delay: "-4s",
  },
];

/** True from the `sm` breakpoint up. False on the server and first client render, so markup always matches. */
function useFromSm() {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setMatches(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return matches;
}

export function HomeHero() {
  const reduce = useReducedMotion();
  const fromSm = useFromSm();
  const ref = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  // Parallax travel stays below the gap between the chips and the cream fade (64px at `sm`, more from `md`),
  // and is off on phones, where the chips sit in a row right above the fade.
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, 56]);
  const sceneOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.4]);
  const parallax = fromSm && !reduce;

  const rise = (delay: number) =>
    reduce
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } };

  const word = (i: number, base: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: "0.45em" },
          animate: { opacity: 1, y: "0em" },
          transition: { duration: 0.7, delay: base + i * 0.06, ease: EASE },
        };

  return (
    <section
      ref={ref}
      aria-labelledby="home-hero-title"
      className="relative isolate w-full overflow-hidden bg-orza-hero text-[var(--orza-hero-text)]"
    >
      {/* Radial washes: cyan top-left, violet bottom-right, warm glow behind the orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 22% 16%, rgba(47,210,240,0.10) 0%, rgba(7,9,12,0) 55%)," +
            "radial-gradient(ellipse at 84% 88%, rgba(191,168,255,0.11) 0%, rgba(7,9,12,0) 55%)," +
            "radial-gradient(ellipse at 72% 44%, rgba(255,180,84,0.08) 0%, rgba(7,9,12,0) 60%)",
        }}
      />
      {/* Grain */}
      <div aria-hidden className="orza-hero-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />

      {/* z-10 keeps the content above the cream fade; bottom padding is 64px taller than the fade so the chips clear it. */}
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 pb-40 pt-28 sm:px-6 sm:pb-48 sm:pt-32 lg:px-8 lg:pt-40">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          {/* Left: editorial copy */}
          <div className="relative z-10">
            <motion.div
              {...rise(0)}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-orza"
            >
              <Sparkles size={12} strokeWidth={1.75} className="text-orza-cyan-400" aria-hidden />
              AI-Powered Wellness Platform
            </motion.div>

            <h1
              id="home-hero-title"
              className="mt-5 font-editorial text-[38px] font-semibold leading-[1.08] tracking-[-0.025em] text-white sm:text-[50px] lg:text-[58px]"
            >
              <span className="block">
                {LINE_ONE.map((w, i) => (
                  <React.Fragment key={w}>
                    <motion.span className="inline-block" {...word(i, 0.05)}>
                      {w}
                    </motion.span>{" "}
                  </React.Fragment>
                ))}
                <motion.em className="orza-energy-text inline-block pr-[0.08em] italic" {...word(LINE_ONE.length, 0.05)}>
                  reimagined
                </motion.em>
              </span>
              <span className="block text-[rgba(255,231,200,0.94)]">
                {LINE_TWO.map((w, i) => (
                  <React.Fragment key={w}>
                    <motion.span className="inline-block" {...word(i, 0.3)}>
                      {w}
                    </motion.span>
                    {i < LINE_TWO.length - 1 ? " " : null}
                  </React.Fragment>
                ))}
              </span>
            </h1>

            <motion.p {...rise(0.35)} className="mt-6 max-w-xl text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
              Snap your meals, chat naturally, get instant nutritional insights. AI that learns your lifestyle, respects your
              choices, and helps you thrive — judgment-free.
            </motion.p>

            <motion.div {...rise(0.45)} className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/login?mode=signup" variant="hero" size="lg" className="px-6">
                Start Free <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="hero-outline" size="lg" className="px-5">
                See How It Works <ChevronDown size={15} strokeWidth={1.75} aria-hidden />
              </ButtonLink>
            </motion.div>

            <motion.p
              {...(reduce ? { initial: false as const } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.8, delay: 0.7 } })}
              className="mt-10 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45"
            >
              English · Hindi · Hinglish
            </motion.p>
          </div>

          {/* Right: convergence orb with floating glass chips */}
          <motion.div
            style={parallax ? { y: sceneY, opacity: sceneOpacity } : { y: 0, opacity: 1 }}
            className="relative mx-auto w-full max-w-[340px] sm:max-w-[480px] lg:max-w-[560px]"
          >
            <HeroScene />

            <ul
              aria-label="Example insights from ÖRZA"
              className="mt-4 grid grid-cols-3 gap-2 sm:pointer-events-none sm:absolute sm:inset-0 sm:mt-0 sm:block"
            >
              {CHIPS.map((c, i) => (
                <motion.li
                  key={c.label}
                  initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.8 + i * 0.15, ease: EASE }}
                  className={cn("sm:absolute", c.place)}
                >
                  <div className="h-full animate-orza-float" style={{ animationDelay: c.delay }}>
                    <GlassCard
                      variant="hero"
                      padded={false}
                      className={cn(
                        "flex h-full flex-col items-center gap-1.5 px-2 py-3 text-center shadow-[0_18px_50px_rgba(0,0,0,0.35)]",
                        "sm:flex-row sm:items-center sm:gap-3 sm:px-3.5 sm:py-3 sm:text-left"
                      )}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] sm:h-9 sm:w-9">
                        <c.icon size={16} strokeWidth={1.75} className={c.iconClass} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-editorial text-[17px] font-semibold leading-tight tracking-[-0.01em] text-white tabular-nums sm:text-[19px]">
                          {c.value}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-tight text-white/60 sm:whitespace-nowrap sm:text-[12px]">
                          {c.label}
                        </span>
                      </span>
                    </GlassCard>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <div aria-hidden className="mt-12 hidden flex-col items-center gap-2 text-white/45 md:flex lg:mt-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Scroll to explore</span>
          <span className="relative block h-10 w-px overflow-hidden bg-white/15">
            <motion.span
              className="absolute inset-x-0 top-0 block h-4 bg-gradient-to-b from-orza-amber to-orza-pink"
              initial={false}
              animate={reduce ? { y: 12 } : { y: [-16, 40] }}
              transition={reduce ? { duration: 0 } : { duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}
            />
          </span>
        </div>
      </div>

      {/* Dark → cream fade into the next section */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 sm:h-32"
        style={{ background: "linear-gradient(to bottom, rgba(7,9,12,0), #FBF7F1)" }}
      />
    </section>
  );
}
