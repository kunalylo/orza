"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Camera, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";
import { Eyebrow, GlassCard, Heading, IconTile, Section } from "@/components/orza/primitives";
import { ButtonLink } from "@/components/ui/button";

const STEPS: { n: string; title: string; desc: string; icon: LucideIcon; tone: "cyan" | "energy" | "violet" }[] = [
  {
    n: "01",
    title: "Tell us about you",
    desc: "Quick conversational onboarding — we learn your goals, diet, allergies, and lifestyle in under 2 minutes.",
    icon: MessageCircle,
    tone: "cyan",
  },
  {
    n: "02",
    title: "Eat & log naturally",
    desc: "Snap a photo, chat naturally, or tell AI what you ate. AI handles the nutritional analysis.",
    icon: Camera,
    tone: "energy",
  },
  {
    n: "03",
    title: "Get smarter every day",
    desc: "AI-powered insights, recipes, compensation plans, and daily reports — personalized to you.",
    icon: Sparkles,
    tone: "violet",
  },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export function HomeSteps() {
  const reduce = useReducedMotion();

  return (
    <Section id="how-it-works" tone="raised">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>How it works</Eyebrow>
          <Heading className="mt-3">Three steps to start</Heading>
        </div>
        <ButtonLink href="/login?mode=signup" variant="secondary" size="lg" className="self-start sm:self-auto">
          Start Free <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </ButtonLink>
      </div>

      <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6 lg:mt-16 lg:gap-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const last = i === STEPS.length - 1;
          return (
            <motion.li
              key={s.n}
              className="relative flex gap-5 md:block"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: 0.15 * i, ease: EASE }}
            >
              {/* Connecting line to the next step: vertical on mobile, horizontal from md up */}
              {!last && (
                <>
                  <span aria-hidden className="absolute -bottom-8 left-6 top-12 w-px bg-[rgba(20,20,20,0.10)] md:hidden">
                    <motion.span
                      className="block h-full w-full origin-top bg-gradient-to-b from-orza-amber via-orza-coral to-orza-pink"
                      initial={reduce ? false : { scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.9, delay: 0.35 + 0.25 * i, ease: EASE }}
                    />
                  </span>
                  <span
                    aria-hidden
                    className="absolute left-12 top-6 hidden h-px w-[calc(100%-1.5rem)] bg-[rgba(20,20,20,0.10)] md:block lg:w-[calc(100%-1rem)]"
                  >
                    <motion.span
                      className="block h-full w-full origin-left bg-gradient-to-r from-orza-amber via-orza-coral to-orza-pink"
                      initial={reduce ? false : { scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.9, delay: 0.35 + 0.25 * i, ease: EASE }}
                    />
                  </span>
                </>
              )}

              {/* Step marker */}
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(20,20,20,0.10)] bg-orza-bg-0 shadow-orza-glass">
                <span className="font-mono text-[13px] font-medium tracking-[0.06em] text-orza-strong">{s.n}</span>
                <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orza-dot ring-2 ring-orza-bg-1" />
              </div>

              <GlassCard className="min-w-0 flex-1 md:mt-6">
                <IconTile tone={s.tone}>
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                </IconTile>
                <h3 className="mt-4 font-editorial text-xl font-semibold tracking-[-0.01em] text-orza-strong sm:text-[22px]">
                  <span className="sr-only">Step {s.n}: </span>
                  {s.title}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-orza-muted">{s.desc}</p>
              </GlassCard>
            </motion.li>
          );
        })}
      </ol>
    </Section>
  );
}
