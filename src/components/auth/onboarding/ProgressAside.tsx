"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { Eyebrow } from "@/components/orza/primitives";
import { STEP_LABELS, answerLabel, sequenceFor, type OnboardingAnswers, type StepId } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

/** Desktop side panel: every step of the conversation, what's been answered, and where we are. */
export function ProgressAside({ answers, step, done }: { answers: OnboardingAnswers; step: StepId | null; done: boolean }) {
  const seq = sequenceFor(answers);
  const current = done || step === "complete" ? seq.length : Math.max(0, seq.indexOf(step as (typeof seq)[number]));
  const answered = Math.min(current, seq.length - 1); // the summary isn't a question

  return (
    <div className="rounded-orza-lg border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.58)] p-5 shadow-orza-glass backdrop-blur-orza">
      <Eyebrow>Your profile</Eyebrow>
      <div className="mt-2 font-editorial text-[20px] font-semibold leading-7 text-orza-strong">Building your plan</div>
      <p className="mt-1 text-[13px] text-orza-muted">
        {done ? "All saved — welcome in." : `${answered} of ${seq.length - 1} answered`}
      </p>

      <ol className="mt-4 space-y-0.5">
        {seq.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "next";
          const value = state === "done" ? (s === "summary" ? "Saved" : answerLabel(s, answers)) : "";
          return (
            <li
              key={s}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-orza-sm px-2.5 py-2 transition-colors duration-220 ease-orza",
                state === "current" && "bg-white/80 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_6px_18px_rgba(20,20,20,0.06)]"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  state === "done" && "border-transparent bg-[#141414] text-orza-bg-0",
                  state === "current" && "border-[rgba(255,122,106,0.45)] bg-[#FFF1EA]",
                  state === "next" && "border-[rgba(20,20,20,0.16)] bg-white/60"
                )}
              >
                {state === "done" && <Check size={12} strokeWidth={2.5} />}
                {state === "current" && <span className="h-2 w-2 animate-orza-pulse rounded-full bg-orza-dot" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn("text-[13px] font-medium leading-5", state === "next" ? "text-orza-subtle" : "text-orza-strong")}>
                  {STEP_LABELS[s]}
                  <span className="sr-only">{state === "done" ? " — answered" : state === "current" ? " — current question" : ""}</span>
                </div>
                {value && <div className="truncate text-[12px] leading-5 text-orza-muted" title={value}>{value}</div>}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 border-t border-[rgba(20,20,20,0.08)] pt-4 text-[12px] leading-relaxed text-orza-subtle">
        Nothing here is set in stone — you can fine-tune your profile and targets anytime in Settings.
      </p>
    </div>
  );
}
