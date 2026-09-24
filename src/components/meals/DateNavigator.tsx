"use client";
import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatDayLabel } from "./meal-utils";

/** Glass pill: ‹ day label (opens a native date picker) › plus a "Today" jump. */
export function DateNavigator({
  date,
  today,
  onChange,
  className,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const label = formatDayLabel(date, today, addDays(today, -1));
  const atToday = date >= today;

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  const iconBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full text-orza-muted transition-colors duration-150 ease-orza hover:bg-white hover:text-orza-strong disabled:opacity-35 disabled:pointer-events-none";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative inline-flex items-center gap-0.5 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/70 p-1 shadow-orza-glass backdrop-blur-orza">
        <button type="button" className={iconBtn} aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}>
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={openPicker}
          aria-label={`Choose a date. Showing ${label}`}
          className="inline-flex h-8 min-w-[132px] items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-medium text-orza-strong transition-colors duration-150 ease-orza hover:bg-white"
        >
          <CalendarDays size={14} strokeWidth={1.75} className="text-[#E0593F]" aria-hidden />
          <span aria-live="polite">{label}</span>
        </button>
        <button type="button" className={iconBtn} aria-label="Next day" disabled={atToday} onClick={() => onChange(addDays(date, 1))}>
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
        <input
          ref={inputRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          max={today}
          value={date}
          onChange={(e) => e.target.value && e.target.value <= today && onChange(e.target.value)}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      </div>
      {!atToday && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className="h-8 rounded-full px-3 text-[13px] font-medium text-orza-muted transition-colors duration-150 ease-orza hover:bg-white/70 hover:text-orza-strong"
        >
          Today
        </button>
      )}
    </div>
  );
}
