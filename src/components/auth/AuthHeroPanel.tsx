"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Brain, Camera, Mic, Sparkles, type LucideIcon } from "lucide-react";
import { BrandMark, IconTile } from "@/components/orza/primitives";
import { cn } from "@/lib/utils";
import { AuthOrb } from "./AuthOrb";

const EASE = [0.16, 1, 0.3, 1] as const;

const BENEFITS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Camera,
    title: "Snap & Know",
    body: "Photograph your meal — AI estimates calories, protein, carbs and fat in seconds.",
  },
  {
    icon: Mic,
    title: "Speak naturally",
    body: "Log meals and ask questions by voice or chat in English, Hindi and Hinglish.",
  },
  {
    icon: Brain,
    title: "AI that remembers",
    body: "Learns your habits, preferences and goals — personalised advice, judgment-free.",
  },
];

/**
 * Dark brand side of /login: warm orb glow, grain, ÖRZA promise and benefits.
 * On phones it collapses to a compact band above the form.
 */
export function AuthHeroPanel({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? { initial: false as const }
      : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.7, delay, ease: EASE } };

  return (
    <aside
      aria-label="About ÖRZA"
      className={cn(
        "relative isolate overflow-hidden bg-orza-hero text-[var(--orza-hero-text)]",
        "rounded-b-orza-xl lg:flex lg:min-h-dvh lg:flex-col lg:rounded-none",
        className
      )}
    >
      {/* Radial washes: cyan top-left, violet bottom-right, warm glow behind the orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 18% 12%, rgba(47,210,240,0.10) 0%, rgba(7,9,12,0) 55%)," +
            "radial-gradient(ellipse at 88% 92%, rgba(191,168,255,0.12) 0%, rgba(7,9,12,0) 55%)," +
            "radial-gradient(ellipse at 80% 78%, rgba(255,180,84,0.10) 0%, rgba(7,9,12,0) 60%)",
        }}
      />
      <div aria-hidden className="orza-hero-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />

      {/* Phone/tablet: soft glow in the corner. Desktop: the full orb, cropped bottom-right. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-10 h-64 w-64 rounded-full lg:hidden"
        style={{
          background: "radial-gradient(circle, rgba(255,231,200,0.55) 0%, rgba(255,180,84,0.35) 22%, rgba(255,122,106,0.16) 45%, rgba(255,95,162,0) 70%)",
          filter: "blur(6px)",
        }}
      />
      <motion.div
        {...(reduce ? { initial: false as const } : { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 1.2, delay: 0.15, ease: EASE } })}
        className="absolute -bottom-[16%] -right-[24%] hidden w-[82%] max-w-[640px] lg:block"
      >
        <AuthOrb tone="dark" className="w-full" />
      </motion.div>

      <div className="relative z-10 flex flex-col px-4 pb-12 pt-5 sm:px-6 lg:flex-1 lg:px-10 lg:py-8 xl:px-14 xl:py-10">
        {/* Top row */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/" aria-label="ÖRZA home" className="rounded-full text-white">
            <BrandMark tone="dark" />
          </Link>
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-3.5 text-[13px] text-white/80 transition-colors duration-150 ease-orza hover:border-white/40 hover:text-white"
          >
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
            Back to home
          </Link>
        </div>

        {/* Promise */}
        <div className="mt-8 max-w-[500px] lg:my-auto lg:py-12">
          <motion.div
            {...rise(0)}
            className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-orza sm:inline-flex"
          >
            <Sparkles size={12} strokeWidth={1.75} className="text-orza-cyan-400" aria-hidden />
            AI-Powered Wellness Platform
          </motion.div>

          <motion.p
            {...rise(0.06)}
            className="font-editorial text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-white sm:mt-5 sm:text-[40px] lg:text-[46px] xl:text-[54px]"
          >
            Your health, <em className="orza-energy-text pr-[0.08em] italic">reimagined</em>
            <span className="hidden text-[rgba(255,231,200,0.94)] sm:block">by AI that evolves with you</span>
          </motion.p>

          <motion.p {...rise(0.14)} className="mt-3 max-w-md text-[14px] leading-relaxed text-white/70 sm:mt-5 sm:text-[16px]">
            Snap your meals, chat naturally, get instant nutritional insights — judgment-free.
          </motion.p>

          <ul className="mt-9 hidden space-y-5 lg:block">
            {BENEFITS.map(({ icon: Icon, title, body }, i) => (
              <motion.li key={title} {...rise(0.22 + i * 0.08)} className="flex items-start gap-3.5">
                <IconTile tone="dark" className="mt-0.5 h-9 w-9">
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </IconTile>
                <div>
                  <div className="text-[15px] font-medium text-white">{title}</div>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-white/60">{body}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <motion.div
            {...rise(0.5)}
            className="mt-9 hidden max-w-[400px] items-center gap-3 rounded-orza-md border border-white/[0.14] bg-white/[0.07] p-3.5 pr-5 backdrop-blur-orza lg:flex"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orza-energy text-white shadow-[0_10px_30px_rgba(255,122,106,0.35)]">
              <Sparkles size={16} strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <div className="text-[14px] font-medium text-white">100 AI credits included</div>
              <div className="text-[13px] text-white/60">Start free. No credit card.</div>
            </div>
          </motion.div>
        </div>

        {/* Footer line (desktop) */}
        <div className="hidden items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.14em] text-white/45 lg:flex">
          <span>English · Hindi · Hinglish</span>
          <span className="text-right">Wellness guidance, not medical advice</span>
        </div>
      </div>
    </aside>
  );
}
