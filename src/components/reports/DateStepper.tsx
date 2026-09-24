"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Prev / label / next pill used for day and week navigation. */
export function DateStepper({
  label,
  sublabel,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  nextDisabled,
  className,
}: {
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
  nextDisabled?: boolean;
  className?: string;
}) {
  const btn =
    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-orza-muted transition-colors duration-150 ease-orza hover:bg-white hover:text-orza-strong disabled:pointer-events-none disabled:opacity-35";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/65 p-1 shadow-orza-glass backdrop-blur-orza",
        className
      )}
    >
      <button type="button" onClick={onPrev} aria-label={prevLabel} className={btn}>
        <ChevronLeft size={18} strokeWidth={1.9} />
      </button>
      <div className="min-w-[132px] px-2 text-center sm:min-w-[168px]" aria-live="polite">
        <div className="font-editorial text-[16px] font-semibold leading-tight text-orza-strong sm:text-[17px]">{label}</div>
        {sublabel && <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">{sublabel}</div>}
      </div>
      <button type="button" onClick={onNext} aria-label={nextLabel} disabled={nextDisabled} className={btn}>
        <ChevronRight size={18} strokeWidth={1.9} />
      </button>
    </div>
  );
}
