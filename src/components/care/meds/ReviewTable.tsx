"use client";
import * as React from "react";
import { AlertTriangle, Plus, Trash2, X } from "lucide-react";
import type { DoseTiming, ExtractedMedicine } from "@/lib/types";
import { cn } from "@/lib/utils";
import { describeFrequency, parseFrequency } from "@/lib/care/frequency";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { formatTime12, TIMING_OPTIONS, type ReviewRow } from "./shared";

export const LOW_CONFIDENCE = 0.6;
const MAX_ROW_TIMES = 12;

let seq = 0;
export const rowKey = () => `row-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function toRows(meds: ExtractedMedicine[]): ReviewRow[] {
  return meds.map((m) => ({ ...m, times: [...m.times], key: rowKey(), include: true }));
}

export function emptyRow(): ReviewRow {
  return { key: rowKey(), include: true, name: "", form: "tablet", dose: "1 tablet", timing: "any", times: ["08:00", "21:00"], frequency_text: "1-0-1", as_needed: false, confidence: 1 };
}

/** Problems that block "Create alarms" for one included row (null = fine). */
export function rowProblem(r: ReviewRow): string | null {
  if (!r.include) return null;
  if (!r.name.trim()) return "Add the medicine's name.";
  if (!r.as_needed && !r.times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)).length) return "Add at least one alarm time, or mark it SOS.";
  if (r.duration_days != null && (!Number.isInteger(r.duration_days) || r.duration_days < 1 || r.duration_days > 365)) return "Days should be 1 to 365 (leave empty if ongoing).";
  return null;
}

function TimesEditor({ row, onChange, idBase }: { row: ReviewRow; onChange: (times: string[]) => void; idBase: string }) {
  if (row.as_needed) return <p className="text-[12px] text-[#0B6F82]">Only when needed — no alarms</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={`Alarm times for ${row.name || "this medicine"}`}>
      {row.times.map((t, i) => (
        <li key={i} className="flex items-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white pl-2.5 pr-0.5">
          <input
            id={`${idBase}-t${i}`}
            type="time"
            value={t}
            step={300}
            onChange={(e) => onChange(row.times.map((x, j) => (j === i ? e.target.value : x)))}
            className="h-8 bg-transparent text-[13px] tabular-nums text-orza-strong focus:outline-none"
            aria-label={`Alarm time ${i + 1}${/^\d{2}:\d{2}$/.test(t) ? ` (${formatTime12(t)})` : ""}`}
          />
          <button
            type="button"
            onClick={() => onChange(row.times.filter((_, j) => j !== i))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-orza-muted hover:bg-black/5 hover:text-[#B02C2C]"
            aria-label={`Remove alarm time ${i + 1}`}
          >
            <X size={12} aria-hidden />
          </button>
        </li>
      ))}
      {row.times.length < MAX_ROW_TIMES && (
        <li>
          <button
            type="button"
            onClick={() => onChange([...row.times, row.times.includes("08:00") ? (row.times.includes("21:00") ? "14:00" : "21:00") : "08:00"])}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-[rgba(20,20,20,0.18)] px-2.5 text-[12px] font-medium text-orza-muted hover:text-orza-strong"
            aria-label={`Add an alarm time for ${row.name || "this medicine"}`}
          >
            <Plus size={12} aria-hidden /> Time
          </button>
        </li>
      )}
    </ul>
  );
}

const cellLabel = "mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-orza-subtle lg:sr-only";

/**
 * Editable review of scanned (or typed) medicines: include, name, strength, dose, frequency as
 * written (re-parsed as you type), alarm times, food timing, course length and SOS.
 * Stacked cards on phones, a table on wide screens.
 */
export function ReviewTable({
  rows,
  onChange,
  showErrors,
}: {
  rows: ReviewRow[];
  onChange: (rows: ReviewRow[]) => void;
  showErrors: boolean;
}) {
  const update = (key: string, patch: Partial<ReviewRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onFrequency = (r: ReviewRow, text: string) => {
    const p = parseFrequency(text);
    const patch: Partial<ReviewRow> = { frequency_text: text };
    if (p.recognized) {
      patch.as_needed = p.as_needed;
      if (!p.as_needed && p.times.length) patch.times = p.times;
      if (p.as_needed) patch.times = [];
    }
    if (p.duration_days) patch.duration_days = p.duration_days;
    else if (p.ongoing) patch.duration_days = undefined;
    if (p.timing && (r.timing === "any" || r.timing === parseFrequency(r.frequency_text).timing)) patch.timing = p.timing;
    update(r.key, patch);
  };

  return (
    <div>
      <div
        className="hidden gap-3 border-b border-[rgba(20,20,20,0.08)] px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle lg:grid lg:grid-cols-[24px_minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,1.9fr)_minmax(0,0.95fr)_72px_44px_32px]"
        aria-hidden
      >
        <span />
        <span>Medicine</span>
        <span>Dose</span>
        <span>When · alarm times</span>
        <span>Food</span>
        <span>Days</span>
        <span>SOS</span>
        <span />
      </div>
      <ul className="mt-2 space-y-2.5" aria-label="Medicines found">
        {rows.map((r, idx) => {
          const id = `rv-${r.key}`;
          const problem = showErrors ? rowProblem(r) : null;
          const low = (r.confidence ?? 1) < LOW_CONFIDENCE;
          const parsedHint = r.frequency_text ? describeFrequency(parseFrequency(r.frequency_text)) : "";
          return (
            <li
              key={r.key}
              className={cn(
                "rounded-orza-md border p-3 transition-opacity duration-150",
                problem ? "border-[rgba(176,44,44,0.35)] bg-[#FFF7F7]" : low && r.include ? "border-[rgba(176,106,0,0.35)] bg-[#FFFBF3]" : "border-[rgba(20,20,20,0.08)] bg-white/70",
                !r.include && "opacity-55"
              )}
            >
              <div className="grid grid-cols-[24px_minmax(0,1fr)_32px] gap-x-3 gap-y-3 lg:grid-cols-[24px_minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,1.9fr)_minmax(0,0.95fr)_72px_44px_32px] lg:items-start">
                {/* Include */}
                <div className="pt-2.5">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(r.key, { include: e.target.checked })}
                    className="h-4 w-4 accent-[#0B8FA6]"
                    aria-label={`Include ${r.name || `medicine ${idx + 1}`}`}
                  />
                </div>

                {/* Medicine */}
                <div className="min-w-0 space-y-2">
                  <div>
                    <label htmlFor={`${id}-name`} className={cellLabel}>
                      Medicine
                    </label>
                    <Input
                      id={`${id}-name`}
                      value={r.name}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                      placeholder="Medicine name"
                      maxLength={80}
                      className="h-10 font-medium"
                      aria-invalid={!!problem && !r.name.trim()}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${id}-strength`} className={cellLabel}>
                      Strength
                    </label>
                    <Input
                      id={`${id}-strength`}
                      value={r.strength || ""}
                      onChange={(e) => update(r.key, { strength: e.target.value || undefined })}
                      placeholder="Strength, e.g. 500 mg"
                      maxLength={40}
                      className="h-9 text-[14px]"
                    />
                  </div>
                  {r.instructions && <p className="text-[12px] leading-snug text-orza-muted">{r.instructions}</p>}
                </div>

                {/* Delete (mobile position: top right) */}
                <div className="col-start-3 row-start-1 flex justify-end pt-1 lg:col-start-8">
                  <button
                    type="button"
                    onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-orza-muted hover:bg-black/5 hover:text-[#B02C2C]"
                    aria-label={`Remove ${r.name || `medicine ${idx + 1}`} from the list`}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </div>

                {/* Dose */}
                <div className="col-span-2 col-start-2 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                  <label htmlFor={`${id}-dose`} className={cellLabel}>
                    Dose
                  </label>
                  <Input id={`${id}-dose`} value={r.dose} onChange={(e) => update(r.key, { dose: e.target.value })} placeholder="1 tablet" maxLength={40} className="h-10 text-[14px]" />
                </div>

                {/* When */}
                <div className="col-span-2 col-start-2 space-y-2 lg:col-span-1 lg:col-start-4 lg:row-start-1">
                  <div>
                    <label htmlFor={`${id}-freq`} className={cellLabel}>
                      As written
                    </label>
                    <Input
                      id={`${id}-freq`}
                      value={r.frequency_text}
                      onChange={(e) => onFrequency(r, e.target.value)}
                      placeholder="1-0-1, BD, TDS x 5 days…"
                      maxLength={80}
                      className="h-10 font-mono text-[13px]"
                      aria-describedby={parsedHint ? `${id}-freq-hint` : undefined}
                    />
                    {parsedHint && (
                      <p id={`${id}-freq-hint`} className="mt-1 text-[11px] text-orza-subtle">
                        {parsedHint}
                      </p>
                    )}
                  </div>
                  <TimesEditor row={r} onChange={(times) => update(r.key, { times })} idBase={id} />
                </div>

                {/* Timing */}
                <div className="col-span-2 col-start-2 grid grid-cols-[minmax(0,1fr)_88px_auto] items-end gap-3 lg:contents">
                  <div className="lg:col-start-5 lg:row-start-1">
                    <label htmlFor={`${id}-timing`} className={cellLabel}>
                      Food
                    </label>
                    <Select id={`${id}-timing`} value={r.timing} onChange={(e) => update(r.key, { timing: e.target.value as DoseTiming })} className="h-10 text-[14px]">
                      {TIMING_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="lg:col-start-6 lg:row-start-1">
                    <label htmlFor={`${id}-days`} className={cellLabel}>
                      Days
                    </label>
                    <Input
                      id={`${id}-days`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={365}
                      value={r.duration_days ?? ""}
                      onChange={(e) => update(r.key, { duration_days: e.target.value === "" ? undefined : Math.round(Number(e.target.value)) })}
                      placeholder="Ongoing"
                      className="h-10 px-2.5 text-center text-[14px] placeholder:text-[12px]"
                    />
                  </div>
                  <div className="pb-2.5 lg:col-start-7 lg:row-start-1 lg:pb-0 lg:pt-2.5">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-orza-strong">
                      <input
                        type="checkbox"
                        checked={r.as_needed}
                        onChange={(e) =>
                          update(r.key, {
                            as_needed: e.target.checked,
                            times: e.target.checked ? [] : r.times.length ? r.times : parseFrequency(r.frequency_text).times.length ? parseFrequency(r.frequency_text).times : ["08:00"],
                          })
                        }
                        className="h-4 w-4 accent-[#0B8FA6]"
                      />
                      <span className="lg:sr-only">SOS</span>
                    </label>
                  </div>
                </div>
              </div>

              {(problem || (low && r.include)) && (
                <p className={cn("mt-2.5 flex items-center gap-1.5 pl-9 text-[12px]", problem ? "text-[#B02C2C]" : "text-[#8A5300]")} role={problem ? "alert" : undefined}>
                  <AlertTriangle size={13} aria-hidden />
                  {problem || "Hard to read — please check this one against your prescription."}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="ghost" size="sm" className="mt-3 border border-dashed border-[rgba(20,20,20,0.18)]" onClick={() => onChange([...rows, emptyRow()])}>
        <Plus size={14} aria-hidden /> Add a medicine
      </Button>
    </div>
  );
}
