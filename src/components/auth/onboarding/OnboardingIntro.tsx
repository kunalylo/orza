"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock3, MessageCircle, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/orza/primitives";
import { AuthOrb } from "../AuthOrb";

const EASE = [0.16, 1, 0.3, 1] as const;

const FACTS: { icon: LucideIcon; label: string }[] = [
  { icon: Clock3, label: "Under 2 minutes" },
  { icon: MessageCircle, label: "Tap or type your answers" },
  { icon: SlidersHorizontal, label: "Fine-tune anytime" },
];

/** First screen for brand-new users (from the wellness app: "Let's get to know you"). */
export function OnboardingIntro({ firstName, onBegin }: { firstName: string; onBegin: () => void }) {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10 text-center sm:py-14">
      <motion.div
        {...(reduce ? { initial: false as const } : { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 1, ease: EASE } })}
        className="w-[180px] sm:w-[220px]"
      >
        <AuthOrb tone="light" className="w-full" />
      </motion.div>

      <motion.div {...rise(0.1)}>
        <Eyebrow className="mt-4">{firstName ? `Welcome, ${firstName}` : "Welcome to ÖRZA"}</Eyebrow>
      </motion.div>
      <motion.h1
        {...rise(0.16)}
        className="mt-3 font-editorial text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-orza-strong sm:text-[46px]"
      >
        Let&rsquo;s get to know <em className="orza-energy-text pr-[0.06em] italic">you</em>
      </motion.h1>
      <motion.p {...rise(0.24)} className="mt-4 max-w-md text-[16px] leading-relaxed text-orza-muted sm:text-[17px]">
        I&rsquo;ll ask you a few quick questions to personalize your wellness experience. Takes less than 2 minutes!
      </motion.p>

      <motion.ul {...rise(0.32)} className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {FACTS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/70 px-3 py-1.5 text-[13px] text-orza-muted backdrop-blur-orza"
          >
            <Icon size={14} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />
            {label}
          </li>
        ))}
      </motion.ul>

      <motion.div {...rise(0.4)} className="mt-9">
        <Button variant="primary" size="lg" className="h-12 px-8 text-[15px]" onClick={onBegin}>
          Let&rsquo;s begin
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
        </Button>
      </motion.div>
    </div>
  );
}
