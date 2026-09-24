"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GlassCard, IconTile } from "@/components/orza/primitives";
import { cn, formatNumber } from "@/lib/utils";
import { dayMonth, dayOfMonth, weekdayLong, weekdayShort, type WeeklyDay } from "./format";

const EASE = [0.16, 1, 0.3, 1] as const;
/** Warm energy gradient, amber at the base rising to pink (the site's calendar load bars, turned upright). */
const ENERGY_BAR = "linear-gradient(0deg, #FFB454 0%, #FF7A6A 55%, #FF5FA2 100%)";

/**
 * Calories per day as warm bars against a dashed target line and a ±10% band.
 * The visual is aria-hidden; a screen-reader table carries the same data.
 */
export function CalorieChart({ days, target, today, bestDate }: { days: WeeklyDay[]; target: number; today: string; bestDate?: string }) {
  const reduce = useReducedMotion();
  const peak = Math.max(target, ...days.map((d) => d.calories));
  const scaleMax = Math.max(peak * 1.14, target * 1.25, 1);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  const within = (v: number) => target > 0 && Math.abs(v - target) / target <= 0.1;

  return (
    <figure>
      <div aria-hidden>
        <div className="relative h-[210px] sm:h-[250px]">
          {/* gridlines */}
          <div className="absolute inset-x-0 border-t border-[rgba(20,20,20,0.05)]" style={{ bottom: "50%" }} />
          <div className="absolute inset-x-0 bottom-0 border-t border-[rgba(20,20,20,0.14)]" />
          {/* ±10% target band + target line */}
          {target > 0 && (
            <>
              <div
                className="absolute inset-x-0 bg-[rgba(18,122,86,0.07)]"
                style={{ bottom: `${pct(target * 0.9)}%`, height: `${pct(target * 1.1) - pct(target * 0.9)}%` }}
              />
              <div className="absolute inset-x-0 border-t-[1.5px] border-dashed border-[rgba(194,65,12,0.55)]" style={{ bottom: `${pct(target)}%` }} />
            </>
          )}
          <div className="absolute inset-0 grid grid-cols-7 gap-1.5 sm:gap-3">
            {days.map((d, i) => (
              <div key={d.date} className="relative flex h-full items-end justify-center">
                {d.meals_count > 0 ? (
                  <motion.div
                    className={cn(
                      "relative w-full max-w-[48px] rounded-b-[3px] rounded-t-[10px] shadow-[0_8px_22px_rgba(255,122,106,0.22)]",
                      d.date === bestDate && "ring-2 ring-[rgba(255,122,106,0.35)] ring-offset-2 ring-offset-[#FBF7F1]"
                    )}
                    style={{ background: ENERGY_BAR, opacity: within(d.calories) ? 1 : 0.78 }}
                    initial={reduce ? false : { height: "0%" }}
                    animate={{ height: `${Math.max(pct(d.calories), 2)}%` }}
                    transition={{ duration: 0.8, delay: 0.05 * i, ease: EASE }}
                  >
                    <span className="absolute -top-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] tabular-nums text-orza-strong sm:text-[11px]">
                      {formatNumber(d.calories)}
                    </span>
                  </motion.div>
                ) : (
                  <div className="mb-px h-1 w-full max-w-[48px] rounded-full bg-[rgba(20,20,20,0.10)]" />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-7 gap-1.5 text-center sm:gap-3">
          {days.map((d) => (
            <div key={d.date} className="flex flex-col items-center">
              <span className={cn("font-mono text-[10px] uppercase tracking-[0.1em]", d.date === today ? "font-medium text-[#C2410C]" : "text-orza-muted")}>
                {weekdayShort(d.date)}
              </span>
              <span className="text-[12px] tabular-nums text-orza-subtle">{dayOfMonth(d.date)}</span>
              {d.date === bestDate && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-orza-dot" />}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">Calories per day for the week, with a daily target of {formatNumber(target)} kcal.</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Calories</th>
            <th scope="col">Meals logged</th>
            <th scope="col">Within 10% of target</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">
                {weekdayLong(d.date)} {dayMonth(d.date)}
                {d.date === bestDate ? " (most balanced day)" : ""}
              </th>
              <td>{d.meals_count ? `${formatNumber(d.calories)} kcal` : "Not logged"}</td>
              <td>{d.meals_count}</td>
              <td>{d.meals_count ? (within(d.calories) ? "Yes" : "No") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const TONES = {
  violet: { bar: "linear-gradient(0deg, #BFA8FF 0%, #8757F2 100%)", line: "rgba(110,62,214,0.5)", tile: "violet" as const },
  cyan: { bar: "linear-gradient(0deg, #63E2FA 0%, #0BBEDC 100%)", line: "rgba(11,143,166,0.5)", tile: "cyan" as const },
  success: { bar: "linear-gradient(0deg, #5FD3A4 0%, #127A56 100%)", line: "rgba(18,122,86,0.5)", tile: "neutral" as const },
};

/** Small 7-day bar chart (protein, water, steps) with a dashed target line and an sr-only data table. */
export function MiniBars({
  title,
  icon,
  days,
  value,
  target,
  unit,
  tone,
  average,
  today,
}: {
  title: string;
  icon: React.ReactNode;
  days: WeeklyDay[];
  value: (d: WeeklyDay) => number;
  target: number;
  unit: string;
  tone: keyof typeof TONES;
  average: string;
  today: string;
}) {
  const reduce = useReducedMotion();
  const t = TONES[tone];
  const values = days.map(value);
  const scaleMax = Math.max(target * 1.2, ...values.map((v) => v * 1.08), 1);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  const tracked = values.some((v) => v > 0);

  return (
    <GlassCard padded={false} className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconTile tone={t.tile} className="h-9 w-9">
            {icon}
          </IconTile>
          <div>
            <h3 className="text-[14.5px] font-medium text-orza-strong">{title}</h3>
            <p className="text-[12px] text-orza-subtle">
              Target {formatNumber(target)} {unit}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="font-editorial text-[22px] font-semibold leading-none tabular-nums text-orza-strong">{tracked ? average : "—"}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">avg / day</div>
        </div>
      </div>

      <figure className="mt-5">
        <div aria-hidden>
          <div className="relative h-[92px]">
            <div className="absolute inset-x-0 bottom-0 border-t border-[rgba(20,20,20,0.12)]" />
            {target > 0 && <div className="absolute inset-x-0 border-t border-dashed" style={{ bottom: `${pct(target)}%`, borderColor: t.line }} />}
            <div className="absolute inset-0 grid grid-cols-7 gap-2">
              {values.map((v, i) => (
                <div key={days[i].date} className="flex h-full items-end justify-center">
                  {v > 0 ? (
                    <motion.div
                      className="w-full max-w-[22px] rounded-b-[2px] rounded-t-[6px]"
                      style={{ background: t.bar }}
                      initial={reduce ? false : { height: "0%" }}
                      animate={{ height: `${Math.max(pct(v), 3)}%` }}
                      transition={{ duration: 0.7, delay: 0.04 * i, ease: EASE }}
                    />
                  ) : (
                    <div className="mb-px h-[3px] w-full max-w-[22px] rounded-full bg-[rgba(20,20,20,0.10)]" />
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2 text-center">
            {days.map((d) => (
              <span key={d.date} className={cn("font-mono text-[10px] uppercase", d.date === today ? "font-medium text-[#C2410C]" : "text-orza-subtle")}>
                {weekdayShort(d.date).slice(0, 2)}
              </span>
            ))}
          </div>
        </div>
        <figcaption className="sr-only">
          {title} per day, target {formatNumber(target)} {unit}.
        </figcaption>
        <table className="sr-only">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">{title}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => (
              <tr key={d.date}>
                <th scope="row">
                  {weekdayLong(d.date)} {dayMonth(d.date)}
                </th>
                <td>{values[i] > 0 ? `${formatNumber(values[i])} ${unit}` : "Not tracked"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figure>
    </GlassCard>
  );
}
