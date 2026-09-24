"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn, formatNumber } from "@/lib/utils";
import type { WeekDay } from "./types";
import { dayOfMonth, formatShort, weekdayShortLabel } from "./format";

/**
 * Seven-day strip (after the ecosystem site's calendar-intelligence week view):
 * warm heat = calories vs target. Doubles as quick date navigation.
 */
export function WeekStrip({
  week,
  date,
  today,
  target,
  onSelect,
}: {
  week: WeekDay[];
  date: string;
  today: string;
  target: number;
  onSelect: (date: string) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.46)] p-2 backdrop-blur-orza sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-3 px-1 sm:mb-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle sm:text-[11px]">Your week</span>
        <span className="text-[11px] text-orza-subtle sm:text-xs">Warm bars = calories vs your target</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {week.map((d, i) => {
          const heat = target > 0 ? Math.min(1, d.calories / target) : 0;
          const selected = d.date === date;
          const isToday = d.date === today;
          const label = `${formatShort(d.date)}${isToday ? " (today)" : ""}: ${
            d.meals ? `${formatNumber(d.calories)} kcal across ${d.meals} meal${d.meals === 1 ? "" : "s"}` : "nothing logged"
          }`;
          return (
            <motion.button
              key={d.date}
              type="button"
              onClick={() => onSelect(d.date)}
              aria-label={label}
              aria-current={selected ? "date" : undefined}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.03 * i, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative overflow-hidden rounded-orza-sm border text-center",
                "transition-[background-color,border-color,box-shadow] duration-220 ease-orza",
                selected
                  ? "border-[rgba(11,190,220,0.40)] bg-white/90 shadow-orza-glass"
                  : "border-[rgba(20,20,20,0.08)] bg-white/50 hover:bg-white/75"
              )}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, rgba(255,180,84,${heat * 0.16}) 0%, rgba(255,95,162,${heat * 0.11}) 100%)`,
                }}
              />
              <span className="relative flex h-[74px] flex-col items-center gap-1 px-1 pb-2 pt-2 sm:h-[86px] sm:pt-2.5">
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.1em]",
                    isToday ? "font-medium text-[#C2410C]" : "text-orza-muted"
                  )}
                >
                  {weekdayShortLabel(d.date)}
                </span>
                <span
                  className={cn(
                    "font-editorial text-[20px] leading-none tabular-nums sm:text-[24px]",
                    selected ? "font-semibold text-orza-strong" : "text-orza-strong/80"
                  )}
                >
                  {dayOfMonth(d.date)}
                </span>
                <span className="mt-auto h-1 w-full max-w-[44px] overflow-hidden rounded-full bg-[rgba(20,20,20,0.08)]">
                  <span
                    className="block h-full rounded-full bg-orza-energy transition-[width] duration-500 ease-orza-out"
                    style={{ width: `${heat * 100}%` }}
                  />
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
