"use client";
import * as React from "react";
import { Plus, Wand2, X } from "lucide-react";
import type { DoseTiming, Schedule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { timesForPattern } from "@/lib/care/schedule";
import { describeFrequency, parseFrequency } from "@/lib/care/frequency";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Segmented } from "@/components/ui/form";
import { addDaysISO, daysBetweenISO, formatDateShort, scheduleSummary, WEEKDAY_ORDER, WEEKDAYS } from "./shared";

export const MAX_TIMES = 12;

export interface ScheduleDraft {
  as_needed: boolean;
  times: string[];
  repeat: "daily" | "weekdays" | "interval";
  days: number[];
  every_n_days: string;
  start_date: string;
  end_mode: "ongoing" | "days" | "date";
  duration_days: string;
  end_date: string;
}

export function draftFromSchedule(s: Schedule | null, asNeeded: boolean, today: string): ScheduleDraft {
  if (!s) {
    return { as_needed: false, times: ["08:00"], repeat: "daily", days: [], every_n_days: "2", start_date: today, end_mode: "ongoing", duration_days: "5", end_date: "" };
  }
  const n = s.every_n_days && s.every_n_days > 1 ? s.every_n_days : 1;
  return {
    as_needed: asNeeded,
    times: s.times.length ? [...s.times] : asNeeded ? [] : ["08:00"],
    repeat: n > 1 ? "interval" : s.days?.length ? "weekdays" : "daily",
    days: s.days?.length ? [...s.days] : [],
    every_n_days: String(n > 1 ? n : 2),
    start_date: s.start_date,
    end_mode: s.end_date ? "date" : "ongoing",
    duration_days: s.end_date ? String(daysBetweenISO(s.start_date, s.end_date) + 1) : "5",
    end_date: s.end_date || "",
  };
}

const isHHMM = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** Draft → API schedule. Returns an error message instead when something needs fixing. */
export function scheduleFromDraft(d: ScheduleDraft): { schedule: Schedule } | { error: string } {
  const times = [...new Set(d.times.filter(isHHMM))].sort();
  if (!d.as_needed && !times.length) return { error: "Add at least one time for the alarm." };
  if (times.length > MAX_TIMES) return { error: `Up to ${MAX_TIMES} times a day.` };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.start_date)) return { error: "Choose a start date." };
  const schedule: Schedule = { times, days: [], start_date: d.start_date };
  if (d.repeat === "weekdays") {
    if (!d.days.length) return { error: "Pick at least one day of the week." };
    schedule.days = d.days.length === 7 ? [] : [...d.days].sort((a, b) => a - b);
  }
  if (d.repeat === "interval") {
    const n = Number(d.every_n_days);
    if (!Number.isInteger(n) || n < 2 || n > 90) return { error: "Repeat every 2 to 90 days." };
    schedule.every_n_days = n;
  }
  if (d.end_mode === "days") {
    const n = Number(d.duration_days);
    if (!Number.isInteger(n) || n < 1 || n > 365) return { error: "The course length should be 1 to 365 days." };
    schedule.end_date = addDaysISO(d.start_date, n - 1);
  } else if (d.end_mode === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.end_date)) return { error: "Choose an end date." };
    if (d.end_date < d.start_date) return { error: "The end date can't be before the start date." };
    schedule.end_date = d.end_date;
  }
  return { schedule };
}

const QUICK: { key: string; label: string; hint: string; times?: string[]; as_needed?: boolean }[] = [
  { key: "1-0-0", label: "1-0-0", hint: "Morning", times: timesForPattern("1-0-0") || ["08:00"] },
  { key: "0-0-1", label: "0-0-1", hint: "Night", times: timesForPattern("0-0-1") || ["21:00"] },
  { key: "1-0-1", label: "1-0-1", hint: "Morning and night", times: timesForPattern("1-0-1") || ["08:00", "21:00"] },
  { key: "1-1-1", label: "1-1-1", hint: "Morning, afternoon and night", times: timesForPattern("1-1-1") || ["08:00", "14:00", "21:00"] },
  { key: "BD", label: "BD", hint: "Twice a day", times: timesForPattern("BD") || ["08:00", "20:00"] },
  { key: "TDS", label: "TDS", hint: "Three times a day", times: timesForPattern("TDS") || ["08:00", "14:00", "21:00"] },
  { key: "HS", label: "HS", hint: "At bedtime", times: timesForPattern("HS") || ["22:00"] },
  { key: "SOS", label: "SOS", hint: "Only when needed — no alarms", as_needed: true },
];

function nextTime(times: string[]): string {
  const valid = times.filter(isHHMM).sort();
  if (!valid.length) return "08:00";
  const [h, m] = valid[valid.length - 1].split(":").map(Number);
  for (const step of [4, 3, 2, 1]) {
    const nh = h + step;
    if (nh <= 23) {
      const t = `${String(nh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (!valid.includes(t)) return t;
    }
  }
  for (let hh = 6; hh <= 23; hh++) {
    const t = `${String(hh).padStart(2, "0")}:00`;
    if (!valid.includes(t)) return t;
  }
  return "12:00";
}

/**
 * Schedule editor for a medicine: quick Indian patterns, "type it like on your prescription",
 * custom time list, weekdays / every N days, start date and course length or end date.
 */
export function ScheduleEditor({
  value,
  onChange,
  onTiming,
  today,
  idPrefix = "sched",
}: {
  value: ScheduleDraft;
  onChange: (d: ScheduleDraft) => void;
  /** Called when the typed notation includes a food timing ("after food", "AC", "khane ke baad"). */
  onTiming?: (t: DoseTiming) => void;
  today: string;
  idPrefix?: string;
}) {
  const d = value;
  const set = (patch: Partial<ScheduleDraft>) => onChange({ ...d, ...patch });
  const [notation, setNotation] = React.useState("");
  const [notationMsg, setNotationMsg] = React.useState<string | null>(null);

  const sortedTimes = [...d.times].filter(isHHMM).sort().join(",");
  const activeQuick = d.as_needed ? "SOS" : QUICK.find((q) => q.times && [...q.times].sort().join(",") === sortedTimes)?.key;

  const applyNotation = () => {
    const p = parseFrequency(notation);
    if (!p.recognized && !p.duration_days && !p.timing) {
      setNotationMsg("We couldn't read that. Try something like 1-0-1, BD after food, or TDS x 5 days.");
      return;
    }
    const patch: Partial<ScheduleDraft> = {};
    if (p.as_needed) {
      patch.as_needed = true;
      patch.times = [];
    } else if (p.times.length) {
      patch.as_needed = false;
      patch.times = p.times;
    }
    if (p.every_n_days && p.every_n_days > 1) {
      patch.repeat = "interval";
      patch.every_n_days = String(p.every_n_days);
    } else if (p.days?.length) {
      patch.repeat = "weekdays";
      patch.days = p.days;
    } else if (p.times.length) {
      patch.repeat = "daily";
    }
    if (p.duration_days) {
      patch.end_mode = "days";
      patch.duration_days = String(p.duration_days);
    } else if (p.ongoing) {
      patch.end_mode = "ongoing";
    }
    set(patch);
    if (p.timing && onTiming) onTiming(p.timing);
    setNotationMsg(`Set: ${describeFrequency(p) || "schedule updated"}`);
  };

  const preview = scheduleFromDraft(d);
  const lastDay = d.end_mode === "days" && Number(d.duration_days) >= 1 ? addDaysISO(d.start_date, Number(d.duration_days) - 1) : null;
  const year = Number(today.slice(0, 4));

  return (
    <div className="space-y-5">
      {/* Quick patterns */}
      <div>
        <div className="mb-2 text-[13px] font-medium text-orza-strong" id={`${idPrefix}-quick`}>
          How often
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${idPrefix}-quick`}>
          {QUICK.map((q) => {
            const on = activeQuick === q.key;
            return (
              <button
                key={q.key}
                type="button"
                aria-pressed={on}
                title={q.hint}
                onClick={() => (q.as_needed ? set({ as_needed: true, times: [] }) : set({ as_needed: false, times: [...(q.times || [])] }))}
                className={cn(
                  "h-9 rounded-full border px-3.5 font-mono text-[12px] tracking-[0.04em] transition-colors duration-150 ease-orza",
                  on ? "border-[#141414] bg-[#141414] text-orza-bg-0" : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-strong hover:bg-white"
                )}
              >
                {q.label}
                <span className="sr-only"> — {q.hint}</span>
              </button>
            );
          })}
        </div>
        <FieldHint>1-0-1 means morning and night; 1-1-1 adds an afternoon dose. You can change any time below.</FieldHint>
      </div>

      {/* Type it like on the prescription */}
      <div>
        <Label htmlFor={`${idPrefix}-notation`}>Or type it as written on your prescription</Label>
        <div className="flex gap-2">
          <Input
            id={`${idPrefix}-notation`}
            value={notation}
            onChange={(e) => {
              setNotation(e.target.value);
              setNotationMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (notation.trim()) applyNotation();
              }
            }}
            placeholder="e.g. 1-0-1 after food x 5 days"
            autoComplete="off"
          />
          <Button variant="secondary" onClick={applyNotation} disabled={!notation.trim()} className="h-11 shrink-0">
            <Wand2 size={15} aria-hidden />
            Apply
          </Button>
        </div>
        {notationMsg && (
          <p className="mt-1.5 text-xs text-orza-muted" role="status">
            {notationMsg}
          </p>
        )}
      </div>

      {/* Times */}
      {d.as_needed ? (
        <div className="rounded-orza-sm border border-[rgba(11,143,166,0.22)] bg-[#EAF6FF] px-3.5 py-3 text-[13px] text-[#0B6F82]">
          <span className="font-semibold">Only when needed (SOS).</span> ÖRZA won&apos;t ring for this medicine — it stays in your list for reference.{" "}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => set({ as_needed: false, times: d.times.length ? d.times : ["08:00"] })}>
            Set alarm times instead
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-[13px] font-medium text-orza-strong" id={`${idPrefix}-times`}>
            Alarm times
          </div>
          <ul className="flex flex-wrap gap-2" aria-labelledby={`${idPrefix}-times`}>
            {d.times.map((t, i) => (
              <li key={i} className="flex items-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white/80 pl-3 pr-1">
                <input
                  type="time"
                  value={t}
                  step={300}
                  onChange={(e) => set({ times: d.times.map((x, j) => (j === i ? e.target.value : x)) })}
                  className="h-9 bg-transparent text-[14px] tabular-nums text-orza-strong focus:outline-none"
                  aria-label={`Alarm time ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => set({ times: d.times.filter((_, j) => j !== i) })}
                  className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-orza-muted hover:bg-black/5 hover:text-[#B02C2C]"
                  aria-label={`Remove alarm time ${i + 1}`}
                  disabled={d.times.length <= 1}
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            ))}
            {d.times.length < MAX_TIMES && (
              <li>
                <Button variant="ghost" size="sm" onClick={() => set({ times: [...d.times, nextTime(d.times)] })} className="h-9 border border-dashed border-[rgba(20,20,20,0.18)]">
                  <Plus size={14} aria-hidden />
                  Add time
                </Button>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Repeat */}
      {!d.as_needed && (
        <div>
          <div className="mb-2 text-[13px] font-medium text-orza-strong">Repeat</div>
          <Segmented
            size="sm"
            value={d.repeat}
            onChange={(v) => set({ repeat: v, days: v === "weekdays" && !d.days.length ? [1, 2, 3, 4, 5] : d.days })}
            options={[
              { value: "daily", label: "Every day" },
              { value: "weekdays", label: "Some days" },
              { value: "interval", label: "Alternate days" },
            ]}
          />
          {d.repeat === "weekdays" && (
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
              {WEEKDAY_ORDER.map((wd) => {
                const on = d.days.includes(wd);
                return (
                  <button
                    key={wd}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ days: on ? d.days.filter((x) => x !== wd) : [...d.days, wd] })}
                    className={cn(
                      "h-9 w-11 rounded-full border text-[12px] font-medium transition-colors duration-150",
                      on ? "border-[#0B8FA6] bg-[#E8FBFF] text-[#0B6F82]" : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-muted hover:text-orza-strong"
                    )}
                  >
                    {WEEKDAYS[wd]}
                  </button>
                );
              })}
            </div>
          )}
          {d.repeat === "interval" && (
            <div className="mt-3 flex items-center gap-2 text-sm text-orza-strong">
              <label htmlFor={`${idPrefix}-every`}>Every</label>
              <Input
                id={`${idPrefix}-every`}
                type="number"
                inputMode="numeric"
                min={2}
                max={90}
                value={d.every_n_days}
                onChange={(e) => set({ every_n_days: e.target.value })}
                className="h-10 w-20 text-center"
              />
              <span>days</span>
              <span className="text-xs text-orza-subtle">· 2 = alternate days, counted from the start date</span>
            </div>
          )}
        </div>
      )}

      {/* Dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-start`}>Start date</Label>
          <Input id={`${idPrefix}-start`} type="date" value={d.start_date} onChange={(e) => set({ start_date: e.target.value })} />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-orza-strong">Ends</div>
          <Segmented
            size="sm"
            value={d.end_mode}
            onChange={(v) => set({ end_mode: v, end_date: v === "date" && !d.end_date ? addDaysISO(d.start_date || today, 29) : d.end_date })}
            options={[
              { value: "ongoing", label: "Ongoing" },
              { value: "days", label: "For N days" },
              { value: "date", label: "On a date" },
            ]}
          />
        </div>
      </div>
      {d.end_mode === "days" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-orza-strong">
          <label htmlFor={`${idPrefix}-days`}>For</label>
          <Input
            id={`${idPrefix}-days`}
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={d.duration_days}
            onChange={(e) => set({ duration_days: e.target.value })}
            className="h-10 w-20 text-center"
          />
          <span>days</span>
          {lastDay && <span className="text-xs text-orza-subtle">· last dose day {formatDateShort(lastDay, year)}</span>}
        </div>
      )}
      {d.end_mode === "date" && (
        <div className="max-w-[240px]">
          <Label htmlFor={`${idPrefix}-end`}>Last day</Label>
          <Input id={`${idPrefix}-end`} type="date" min={d.start_date} value={d.end_date} onChange={(e) => set({ end_date: e.target.value })} />
        </div>
      )}

      <div className="rounded-orza-sm bg-white/60 px-3.5 py-2.5 text-[13px] text-orza-muted" aria-live="polite">
        {"schedule" in preview ? (
          <>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Summary · </span>
            {scheduleSummary({ schedule: preview.schedule, as_needed: d.as_needed }, today)}
          </>
        ) : (
          <span className="text-[#B02C2C]">{preview.error}</span>
        )}
      </div>
    </div>
  );
}
