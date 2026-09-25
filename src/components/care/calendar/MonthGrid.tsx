"use client";
import * as React from "react";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { KIND_COLOR, KIND_LABEL, type CalendarEvent, type CalendarEventKind } from "./types";
import { BUSY_DAY_MINUTES, busyMinutes, formatLongDate, KIND_ORDER, monthGridDates, shiftMonth, WEEKDAYS_MON_FIRST } from "./utils";

/** Screen-reader summary of a day's events, e.g. "3 medicine doses, 1 meal". */
function daySummary(events: CalendarEvent[]): string {
  if (!events.length) return "nothing scheduled";
  const counts = new Map<CalendarEventKind, number>();
  for (const e of events) counts.set(e.kind, (counts.get(e.kind) || 0) + 1);
  const words: Record<CalendarEventKind, [string, string]> = {
    medication: ["medicine dose", "medicine doses"],
    reminder: ["reminder", "reminders"],
    meal: ["meal", "meals"],
    external: ["calendar event", "calendar events"],
  };
  return KIND_ORDER.filter((k) => counts.get(k))
    .map((k) => `${counts.get(k)} ${words[k][counts.get(k) === 1 ? 0 : 1]}`)
    .join(", ");
}

/**
 * Monday-first month grid. Each day shows one dot per kind of event (medicines, reminders, meals,
 * your calendar) and a coral underline on busy days. Arrow keys move the selection (roving tabindex);
 * PageUp / PageDown change month.
 */
export function MonthGrid({
  month,
  today,
  selected,
  byDate,
  tz,
  loading,
  onSelect,
}: {
  month: string;
  today: string;
  selected: string;
  byDate: Map<string, CalendarEvent[]>;
  tz: string;
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  const dates = React.useMemo(() => monthGridDates(month), [month]);
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const focusNext = React.useRef<string | null>(null);

  React.useEffect(() => {
    const d = focusNext.current;
    if (!d) return;
    focusNext.current = null;
    refs.current.get(d)?.focus();
  });

  const focusable = dates.includes(selected) ? selected : dates.find((d) => d.startsWith(month)) || dates[0];

  const move = (date: string) => {
    focusNext.current = date;
    onSelect(date);
  };

  const onKeyDown = (e: React.KeyboardEvent, date: string) => {
    const col = dates.indexOf(date) % 7;
    let next: string | null = null;
    if (e.key === "ArrowLeft") next = addDays(date, -1);
    else if (e.key === "ArrowRight") next = addDays(date, 1);
    else if (e.key === "ArrowUp") next = addDays(date, -7);
    else if (e.key === "ArrowDown") next = addDays(date, 7);
    else if (e.key === "Home") next = addDays(date, -col);
    else if (e.key === "End") next = addDays(date, 6 - col);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const target = shiftMonth(date.slice(0, 7), e.key === "PageUp" ? -1 : 1);
      const day = Math.min(Number(date.slice(8, 10)), new Date(Date.UTC(Number(target.slice(0, 4)), Number(target.slice(5, 7)), 0)).getUTCDate());
      next = `${target}-${String(day).padStart(2, "0")}`;
    }
    if (next) {
      e.preventDefault();
      move(next);
    }
  };

  const rows: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) rows.push(dates.slice(i, i + 7));

  return (
    <div role="grid" aria-label="Month" aria-busy={loading || undefined} className="w-full select-none">
      <div role="row" className="grid grid-cols-7 pb-2">
        {WEEKDAYS_MON_FIRST.map((w) => (
          <div key={w} role="columnheader" className="text-center font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle sm:text-[11px]">
            <span aria-hidden>{w.slice(0, 1)}</span>
            <span className="sr-only">{w}</span>
            <span aria-hidden className="hidden sm:inline">{w.slice(1)}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-1 sm:gap-1.5">
        {rows.map((row) => (
          <div role="row" key={row[0]} className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {row.map((date) => {
              const inMonth = date.startsWith(month);
              const isToday = date === today;
              const isSelected = date === selected;
              const events = byDate.get(date) || [];
              const kinds = KIND_ORDER.filter((k) => events.some((e) => e.kind === k));
              const busy = busyMinutes(events, date, tz) >= BUSY_DAY_MINUTES;
              const label = `${formatLongDate(date)}${isToday ? ", today" : ""}: ${loading ? "loading" : daySummary(events)}${busy ? ", busy day" : ""}`;
              return (
                <div role="gridcell" key={date} aria-selected={isSelected}>
                  <button
                    ref={(el) => {
                      if (el) refs.current.set(date, el);
                      else refs.current.delete(date);
                    }}
                    type="button"
                    tabIndex={date === focusable ? 0 : -1}
                    aria-label={label}
                    aria-current={isToday ? "date" : undefined}
                    onClick={() => onSelect(date)}
                    onKeyDown={(e) => onKeyDown(e, date)}
                    className={cn(
                      "group relative flex h-12 w-full flex-col items-center justify-start gap-1 rounded-orza-sm border pt-1.5 transition-[background-color,border-color,box-shadow] duration-150 ease-orza sm:h-[72px] sm:items-start sm:px-2 sm:pt-2",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
                      isSelected
                        ? "border-[rgba(20,20,20,0.85)] bg-white shadow-orza-glass"
                        : "border-transparent hover:border-[rgba(20,20,20,0.10)] hover:bg-white/70",
                      !isSelected && inMonth && "bg-white/40",
                      !inMonth && "opacity-45"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular-nums leading-none",
                        isToday ? "bg-orza-energy font-semibold text-white" : "text-orza-strong",
                        isSelected && !isToday && "font-semibold"
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                    <span aria-hidden className="flex h-1.5 items-center gap-[3px] sm:gap-1">
                      {kinds.map((k) => (
                        <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KIND_COLOR[k] }} title={KIND_LABEL[k]} />
                      ))}
                    </span>
                    {busy && (
                      <span aria-hidden className="absolute inset-x-2 bottom-1 h-[3px] rounded-full bg-orza-energy opacity-80 sm:inset-x-2 sm:bottom-1.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
