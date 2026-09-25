"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/form";
import { WEEKDAYS, weekdayOf, formatDateShort, type AdherenceResponse } from "./shared";

function dayTone(t: AdherenceResponse["daily"][number]) {
  if (!t.scheduled) return "none";
  if (!t.total) return "future";
  const r = t.taken / t.total;
  if (r >= 0.999) return "full";
  if (r >= 0.5) return "partial";
  return "low";
}

/** Small ring for one day: arc = taken / doses so far. */
function DayRing({ taken, total, tone }: { taken: number; total: number; tone: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const frac = total ? Math.min(1, taken / total) : 0;
  const color = tone === "full" ? "#127A56" : tone === "partial" ? "#F2A33A" : tone === "low" ? "#E0593F" : "rgba(20,20,20,0.18)";
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(20,20,20,0.08)" strokeWidth="4" />
      {frac > 0 && (
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${frac * c} ${c}`}
          transform="rotate(-90 20 20)"
        />
      )}
      {tone === "full" && <path d="M14.5 20.5l3.6 3.6 7.4-8" fill="none" stroke="#127A56" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/** 7-day adherence strip: one ring per day + overall rate. */
export function AdherenceStrip({ data, loading, today }: { data: AdherenceResponse | null; loading: boolean; today: string }) {
  if (loading && !data) {
    return (
      <div className="grid grid-cols-7 gap-1.5" aria-hidden>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] w-full" />
        ))}
      </div>
    );
  }
  if (!data) return null;
  const { overall } = data;
  const pct = overall.rate != null ? Math.round(overall.rate * 100) : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] text-orza-muted">
          {overall.total ? (
            <>
              <span className="font-semibold text-orza-strong">{overall.taken}</span> of {overall.total} doses taken in the last 7 days
            </>
          ) : (
            "This fills in as doses come due."
          )}
        </div>
        {pct != null && (
          <span className="font-editorial text-[22px] font-semibold leading-none text-orza-strong tabular-nums">
            {pct}
            <span className="ml-0.5 text-[13px] font-normal text-orza-subtle">%</span>
          </span>
        )}
      </div>
      <ol className="grid grid-cols-7 gap-1.5" aria-label="Doses taken each day, last 7 days">
        {data.daily.map((d) => {
          const tone = dayTone(d);
          const isToday = d.date === today;
          const day = `${isToday ? "Today, " : ""}${formatDateShort(d.date)}`;
          const label = !d.scheduled
            ? `${day}: no doses scheduled`
            : `${day}: ${d.taken} of ${d.total} due doses taken${d.missed ? `, ${d.missed} missed` : ""}${d.skipped ? `, ${d.skipped} skipped` : ""}${d.upcoming ? `, ${d.upcoming} still to come` : ""}`;
          return (
            <li
              key={d.date}
              aria-label={label}
              title={label}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-orza-sm border px-0.5 py-2",
                isToday ? "border-[rgba(11,190,220,0.35)] bg-[#F1FCFF]" : "border-[rgba(20,20,20,0.06)] bg-white/50"
              )}
            >
              <span className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", isToday ? "text-[#0B8FA6]" : "text-orza-subtle")}>
                {WEEKDAYS[weekdayOf(d.date)]}
              </span>
              {tone === "none" ? (
                <span className="flex h-8 w-8 items-center justify-center text-[13px] text-orza-subtle sm:h-10 sm:w-10" aria-hidden>
                  –
                </span>
              ) : (
                <DayRing taken={d.taken} total={d.total} tone={tone} />
              )}
              <span className="text-[11px] tabular-nums text-orza-muted" aria-hidden>
                {d.scheduled ? `${d.taken}/${d.total || d.scheduled}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
