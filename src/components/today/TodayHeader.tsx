"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Flame, Loader2 } from "lucide-react";
import { Eyebrow, Tag } from "@/components/orza/primitives";
import { Skeleton } from "@/components/ui/form";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { formatLong, greetingFor, relativeDay, weekdayLong } from "./format";

export function TodayHeader({
  name,
  date,
  today,
  hour,
  streak,
  busy,
  onDateChange,
}: {
  name: string;
  date: string;
  today: string;
  hour: number;
  /** null while loading. */
  streak: number | null;
  busy?: boolean;
  onDateChange: (date: string) => void;
}) {
  const isToday = date === today;
  const isYesterday = date === addDays(today, -1);

  return (
    <header className="mb-6 flex flex-col gap-5 sm:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <Eyebrow>
          {isToday ? "Today" : "Looking back"} · {formatLong(date)}
        </Eyebrow>
        <h1 className="mt-2 font-editorial text-[30px] font-semibold leading-[38px] tracking-[-0.02em] text-orza-strong sm:text-[40px] sm:leading-[48px]">
          {isToday ? (
            <>
              <span suppressHydrationWarning>{greetingFor(hour)}</span>, <em className="font-medium italic">{name}</em>.
            </>
          ) : (
            <>
              {isYesterday ? "Yesterday" : weekdayLong(date)}, <em className="font-medium italic text-orza-muted">at a glance</em>.
            </>
          )}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <StreakTag streak={streak} />
          <p className="text-[14px] text-orza-muted">
            {isToday ? "Here's your wellness snapshot for today." : "A calm look back at what you logged."}
          </p>
        </div>
      </div>
      <DateNav date={date} today={today} busy={busy} onChange={onDateChange} />
    </header>
  );
}

function StreakTag({ streak }: { streak: number | null }) {
  if (streak == null) return <Skeleton className="h-6 w-28 rounded-full" />;
  if (streak <= 0) return <Tag tone="neutral">Log a meal to start a streak</Tag>;
  return (
    <Tag tone="energy" dot={false}>
      <Flame size={13} strokeWidth={2} aria-hidden />
      {streak}-day streak
    </Tag>
  );
}

function DateNav({ date, today, busy, onChange }: { date: string; today: string; busy?: boolean; onChange: (d: string) => void }) {
  const isToday = date >= today;
  const btn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-orza-muted transition-colors duration-150 ease-orza hover:bg-white hover:text-orza-strong disabled:pointer-events-none disabled:opacity-35";
  return (
    <div
      role="group"
      aria-label="Choose a day"
      className="inline-flex items-center gap-1 self-start rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 p-1 shadow-[0_6px_18px_rgba(20,20,20,0.05)] backdrop-blur-orza md:self-auto"
    >
      <button type="button" className={btn} aria-label="Previous day" onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft size={17} strokeWidth={1.75} />
      </button>
      <div className="flex min-w-[112px] items-center justify-center gap-1.5 px-1 text-sm font-medium text-orza-strong" aria-live="polite">
        {busy && <Loader2 size={13} className="animate-spin text-orza-subtle" aria-hidden />}
        <span>{relativeDay(date, today)}</span>
      </div>
      <button type="button" className={btn} aria-label="Next day" disabled={isToday} onClick={() => onChange(addDays(date, 1))}>
        <ChevronRight size={17} strokeWidth={1.75} />
      </button>
      {!isToday && (
        <button
          type="button"
          onClick={() => onChange(today)}
          className={cn(
            "ml-0.5 inline-flex h-9 items-center rounded-full bg-[#141414] px-3.5 text-[13px] font-medium text-orza-bg-0",
            "transition-colors duration-150 ease-orza hover:bg-black"
          )}
        >
          Today
        </button>
      )}
    </div>
  );
}
