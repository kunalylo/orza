"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Eyebrow } from "@/components/orza/primitives";
import { OrzaOrb } from "./OrzaOrb";
import { QUICK_ACTIONS, STARTER_PROMPTS, type QuickAction } from "./prompts";

/** Welcome screen for a fresh conversation: the landing-page prompts as chips, plus the app's quick actions. */
export function ChatEmptyState({
  firstName,
  onPick,
  onQuickAction,
  disabled,
}: {
  firstName?: string;
  onPick: (prompt: string) => void;
  onQuickAction?: (action: QuickAction) => void;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-2 py-8 text-center sm:py-12">
      <motion.div {...rise(0)}>
        <OrzaOrb size={64} glow pulse={!reduce} />
      </motion.div>
      <motion.div {...rise(0.06)} className="mt-7">
        <Eyebrow>{firstName ? `Namaste, ${firstName}` : "Namaste"}</Eyebrow>
        <h2 className="mt-2 font-editorial text-[28px] font-semibold leading-[34px] tracking-[-0.02em] text-orza-strong sm:text-[34px] sm:leading-[42px]">
          How can I help today?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-orza-muted">
          Ask me about meals, recipes, wellness tips, or just chat about your health goals. Type or speak in English, Hindi or
          Hinglish — tell me what you ate and I&apos;ll log it.
        </p>
      </motion.div>
      <motion.ul {...rise(0.14)} className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2" aria-label="Try asking">
        {STARTER_PROMPTS.map((p) => (
          <li key={p}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(p)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 px-4 py-2 text-left text-sm text-orza-strong transition-[background-color,border-color,transform] duration-220 ease-orza hover:-translate-y-[1px] hover:bg-white/85 disabled:pointer-events-none disabled:opacity-60"
            >
              <Sparkles size={12} strokeWidth={1.75} className="shrink-0 text-[#0B8FA6]" aria-hidden />
              {p}
            </button>
          </li>
        ))}
      </motion.ul>
      {onQuickAction && (
        <motion.div {...rise(0.22)} className="mt-8 w-full max-w-2xl">
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-[rgba(20,20,20,0.08)]" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Quick actions</span>
            <span className="h-px flex-1 bg-[rgba(20,20,20,0.08)]" />
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label="Quick actions">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.label}>
                <button
                  type="button"
                  disabled={disabled && !!a.prompt}
                  onClick={() => onQuickAction(a)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(20,20,20,0.08)] bg-white/40 px-3 text-xs text-orza-muted transition-[background-color,color,transform] duration-220 ease-orza hover:-translate-y-[1px] hover:bg-white/80 hover:text-orza-strong disabled:pointer-events-none disabled:opacity-50"
                >
                  <a.icon className="h-3.5 w-3.5 text-[#0B8FA6]" strokeWidth={1.75} aria-hidden />
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
