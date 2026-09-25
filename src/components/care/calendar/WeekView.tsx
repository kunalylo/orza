"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { KIND_COLOR, KIND_LABEL, type CalendarEvent } from "./types";
import { BUSY_DAY_MINUTES, busyMinutes, formatLongDate, formatTime, KIND_ORDER, WEEKDAYS_MON_FIRST } from "./utils";

const MAX_PER_DAY = 7;

/**
 * Week (Monday → Sunday). Phones get a 7-day strip with dots (the agenda below shows the chosen day);
 * tablets and desktops get a 7-column board listing each day's items.
 */
export function WeekView({
  dates,
  today,
  selected,
  byDate,
  tz,
  loading,
  onSelect,
}: {
  dates: string[];
  today: string;
  selected: string;
  byDate: Map<string, CalendarEvent[]>;
  tz: string;
  loading: boolean;
  onSelect: (date: string) => void;
}) {
  return (
    <div aria-busy={loading || undefined}>
      {/* Phone: strip */}
      <div className="grid grid-cols-7 gap-1 md:hidden" role="group" aria-label="Days of the week">
        {dates.map((date, i) => {
          const events = byDate.get(date) || [];
          const kinds = KIND_ORDER.filter((k) => events.some((e) => e.kind === k));
          const isSelected = date === selected;
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${formatLongDate(date)}${isToday ? ", today" : ""}: ${events.length ? `${events.length} item${events.length === 1 ? "" : "s"}` : "nothing scheduled"}`}
              className={cn(
                "flex flex-col items-center gap-1 rounded-orza-sm border py-2 transition-colors duration-150 ease-orza",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan",
                isSelected ? "border-[rgba(20,20,20,0.85)] bg-white shadow-orza-glass" : "border-transparent bg-white/40 hover:bg-white/70"
              )}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">{WEEKDAYS_MON_FIRST[i].slice(0, 2)}</span>
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-[14px] tabular-nums",
                  isToday ? "bg-orza-energy font-semibold text-white" : "text-orza-strong"
                )}
              >
                {Number(date.slice(8, 10))}
              </span>
              <span aria-hidden className="flex h-1.5 items-center gap-[3px]">
                {kinds.map((k) => (
                  <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: KIND_COLOR[k] }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tablet / desktop: board */}
      <div className="hidden grid-cols-7 gap-1.5 md:grid">
        {dates.map((date, i) => {
          const events = byDate.get(date) || [];
          const isSelected = date === selected;
          const isToday = date === today;
          const busy = busyMinutes(events, date, tz) >= BUSY_DAY_MINUTES;
          const shown = events.slice(0, MAX_PER_DAY);
          const more = events.length - shown.length;
          return (
            <div
              key={date}
              className={cn(
                "flex min-h-[260px] min-w-0 flex-col rounded-orza-sm border p-1.5 transition-colors duration-150 ease-orza",
                isSelected ? "border-[rgba(20,20,20,0.85)] bg-white shadow-orza-glass" : "border-[rgba(20,20,20,0.06)] bg-white/40"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(date)}
                aria-pressed={isSelected}
                aria-label={`${formatLongDate(date)}${isToday ? ", today" : ""}${busy ? ", busy day" : ""}. Show this day's agenda`}
                className="flex w-full items-center justify-between rounded-[10px] px-1.5 py-1 text-left hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">{WEEKDAYS_MON_FIRST[i]}</span>
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] tabular-nums",
                    isToday ? "bg-orza-energy font-semibold text-white" : "font-medium text-orza-strong"
                  )}
                >
                  {Number(date.slice(8, 10))}
                </span>
              </button>
              {busy && <div aria-hidden className="mx-1.5 mb-1 h-[3px] rounded-full bg-orza-energy opacity-80" />}
              <ul className="mt-1 flex flex-col gap-1">
                {loading && !events.length
                  ? Array.from({ length: 2 }, (_, k) => <li key={k} className="orza-skeleton h-9 rounded-[8px]" aria-hidden />)
                  : shown.map((e) => (
                      <li key={`${e.id}-${date}`}>
                        <button
                          type="button"
                          onClick={() => onSelect(date)}
                          title={`${KIND_LABEL[e.kind]}: ${e.title}`}
                          className="block w-full rounded-[8px] border-l-[3px] bg-white/80 px-1.5 py-1 text-left transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
                          style={{ borderLeftColor: e.color }}
                        >
                          <span className="block font-mono text-[10px] leading-4 text-orza-subtle">{e.all_day ? "All day" : formatTime(e.start, tz)}</span>
                          <span className={cn("line-clamp-2 break-words text-[12px] leading-4 text-orza-strong", e.status === "taken" || e.status === "skipped" ? "text-orza-muted line-through decoration-[rgba(20,20,20,0.25)]" : "")}>
                            {e.title}
                          </span>
                        </button>
                      </li>
                    ))}
              </ul>
              {more > 0 && (
                <button
                  type="button"
                  onClick={() => onSelect(date)}
                  className="mt-1 rounded-[8px] px-1.5 py-1 text-left text-[11px] font-medium text-orza-muted hover:bg-white hover:text-orza-strong"
                >
                  +{more} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
