"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

/**
 * "ÖRZA says" — the day's one-liner on the dark hero surface with the
 * glowing amber → coral → pink orb from the ecosystem site.
 */
export function InsightCard({ insight }: { insight: string | null }) {
  const reduce = useReducedMotion();
  return (
    <section
      aria-label="ÖRZA says"
      className="relative overflow-hidden rounded-orza-md border border-white/10 bg-orza-hero p-5 text-[var(--orza-hero-text)] shadow-orza-floating sm:p-6"
    >
      {/* ambient light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 10% 0%, rgba(47,210,240,0.12) 0%, rgba(7,9,12,0) 55%)," +
            "radial-gradient(ellipse at 90% 100%, rgba(191,168,255,0.14) 0%, rgba(7,9,12,0) 55%)",
        }}
      />
      <div aria-hidden className="orza-hero-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      {/* the orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 animate-orza-pulse rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,231,200,0.95) 0%, rgba(255,180,84,0.75) 22%, rgba(255,122,106,0.35) 48%, rgba(255,95,162,0) 72%)",
          filter: "blur(6px)",
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-orza-dot shadow-[0_0_12px_rgba(255,180,84,0.85)]" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">ÖRZA says</span>
        </div>

        <div className="mt-4 min-h-[84px] pr-6 sm:pr-10" aria-live="polite">
          {insight == null ? (
            <div className="space-y-2.5" aria-hidden>
              <div className="h-4 w-full rounded-full bg-white/10" />
              <div className="h-4 w-4/5 rounded-full bg-white/10" />
              <div className="h-4 w-2/3 rounded-full bg-white/10" />
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={insight}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="font-editorial text-[19px] leading-[1.45] text-white sm:text-[21px]"
              >
                &ldquo;{insight}&rdquo;
              </motion.p>
            </AnimatePresence>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/chat"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-medium text-[#0B0F14] shadow-[0_18px_60px_rgba(255,255,255,0.14)] transition-colors duration-220 ease-orza hover:bg-white/95"
          >
            Talk it through <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
          <span className="text-[11px] text-white/45">Wellness guidance, not medical advice.</span>
        </div>
      </div>
    </section>
  );
}
