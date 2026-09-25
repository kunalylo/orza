"use client";
import * as React from "react";
import { toast } from "sonner";
import { CircleAlert, FileSpreadsheet, Lock } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { GlassCard, IconTile } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Label, Select } from "@/components/ui/form";
import {
  buildCsvDays,
  CSV_FIELD_LABELS,
  CSV_UNITS,
  detectDateOrder,
  detectMapping,
  MAX_CSV_BYTES,
  parseCsv,
  type ColumnMapping,
  type CsvField,
  type CsvUnit,
  type DateOrder,
} from "./csvImport";
import { formatDay, formatInt, formatKg, formatSleep } from "./format";
import { HEALTH_METRICS, type HealthDayInput, type HealthMetric, type HealthWriteResponse } from "./metrics";

const FIELD_OPTIONS: CsvField[] = ["ignore", "date", ...HEALTH_METRICS];
const MAX_COLUMNS = 40;

const PREVIEW_FORMAT: Record<HealthMetric, (v: number) => string> = {
  steps: (v) => formatInt(v),
  active_kcal: (v) => `${formatInt(v)} kcal`,
  distance_km: (v) => `${v.toFixed(1)} km`,
  sleep_minutes: (v) => formatSleep(v),
  resting_hr: (v) => `${v} bpm`,
  avg_hr: (v) => `${v} bpm`,
  weight_kg: (v) => `${formatKg(v)} kg`,
  water_ml: (v) => `${formatInt(v)} ml`,
};

interface Parsed {
  fileName: string;
  headers: string[];
  rows: string[][];
}

/** CSV import (Health Connect / Google Fit / Samsung Health / spreadsheet exports) with column mapping and a preview. */
export function CsvImportCard({ tz, imperial, onImported }: { tz: string; imperial: boolean; onImported: () => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping[]>([]);
  const [order, setOrder] = React.useState<DateOrder | "auto">("auto");
  const [reading, setReading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const onFile = async (file: File) => {
    if (file.size > MAX_CSV_BYTES) {
      toast.error("That CSV is larger than 25 MB. Export a shorter date range and try again.");
      return;
    }
    setReading(true);
    try {
      const text = await file.text();
      const all = parseCsv(text);
      if (all.length < 2) {
        toast.error("That file has no data rows under the header.");
        return;
      }
      const headers = all[0].slice(0, MAX_COLUMNS).map((h, i) => h.trim() || `Column ${i + 1}`);
      const rows = all.slice(1);
      setParsed({ fileName: file.name, headers, rows });
      setMapping(detectMapping(headers, rows, { imperial }));
      setOrder("auto");
    } catch {
      toast.error("We couldn't read that file. Make sure it's a .csv saved as text.");
    } finally {
      setReading(false);
    }
  };

  const dateCol = mapping.find((m) => m.field === "date");
  const autoOrder = React.useMemo<DateOrder>(
    () => (parsed && dateCol ? detectDateOrder(parsed.rows.map((r) => r[dateCol.index] ?? "")) : "dmy"),
    [parsed, dateCol]
  );
  const result = React.useMemo(
    () => (parsed ? buildCsvDays(parsed.rows, mapping, { tz, dateOrder: order === "auto" ? autoOrder : order }) : null),
    [parsed, mapping, tz, order, autoOrder]
  );
  const metricsUsed = React.useMemo(() => HEALTH_METRICS.filter((m) => result?.days.some((d) => d[m] !== undefined)), [result]);

  const setField = (index: number, field: CsvField) =>
    setMapping((prev) =>
      prev.map((m) => {
        if (m.index === index) {
          if (field === "ignore" || field === "date") return { ...m, field, unit: undefined };
          const units = CSV_UNITS[field] as readonly CsvUnit[];
          const unit = field === "weight_kg" && imperial ? "lb" : field === "distance_km" && imperial ? "mi" : units[0];
          return { ...m, field, unit };
        }
        // One column per field: the column that just took this field releases it elsewhere.
        return m.field === field && field !== "ignore" ? { ...m, field: "ignore", unit: undefined } : m;
      })
    );
  const setUnit = (index: number, unit: CsvUnit) => setMapping((prev) => prev.map((m) => (m.index === index ? { ...m, unit } : m)));

  const close = () => {
    if (saving) return;
    setParsed(null);
  };

  const save = async () => {
    if (!result?.days.length) return;
    setSaving(true);
    try {
      const res = await api.post<HealthWriteResponse>("/health/import", { source: "csv", days: result.days });
      toast.success(`Imported ${formatInt(res.days_updated)} days from ${parsed?.fileName ?? "your CSV"}.`);
      setParsed(null);
      onImported();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const problem = !parsed
    ? null
    : !dateCol
      ? "Choose which column holds the date."
      : !mapping.some((m) => m.field !== "ignore" && m.field !== "date")
        ? "Choose at least one column to import (steps, sleep, weight…)."
        : result && !result.days.length
          ? "No rows had a readable date and a value in a sensible range. Check the date format and units."
          : null;

  const preview: HealthDayInput[] = result ? result.days.slice(-7).reverse() : [];

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-start gap-3">
        <IconTile tone="cyan">
          <FileSpreadsheet className="h-5 w-5" aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <h3 className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">Import a CSV</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-orza-muted">
            Exports from Health Connect apps, Google Fit, Samsung Health, Fitbit or your own spreadsheet. One row per day (or per
            reading) with a date column — ÖRZA matches the columns for you and shows a preview before anything is saved.
          </p>
        </div>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-orza-subtle">
        Recognised columns: date, steps, active energy / calories burned, distance, sleep (hours or minutes), resting heart rate, heart rate,
        weight (kg or lb) and water. Up to 400 days per import.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain,application/vnd.ms-excel"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-orza-subtle">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Only daily totals are uploaded
        </span>
        <Button variant="secondary" onClick={() => inputRef.current?.click()} loading={reading}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          Choose CSV file
        </Button>
      </div>

      <Dialog open={!!parsed} onOpenChange={(o) => !o && close()}>
        {parsed && (
          <DialogContent
            title="Check your CSV import"
            description={`${parsed.fileName} · ${formatInt(parsed.rows.length)} rows. Match each column, then check the preview.`}
            className="w-[min(760px,calc(100%-24px))] p-5 sm:p-7"
          >
            <div className="space-y-5">
              <section aria-labelledby="csv-columns">
                <h4 id="csv-columns" className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
                  Columns
                </h4>
                <ul className="mt-2 divide-y divide-[rgba(20,20,20,0.08)] rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70">
                  {mapping.map((m) => {
                    const sample = parsed.rows.find((r) => (r[m.index] ?? "").trim())?.[m.index]?.trim() ?? "";
                    const units = m.field !== "ignore" && m.field !== "date" ? (CSV_UNITS[m.field] as readonly CsvUnit[]) : [];
                    const fieldId = `csv-field-${m.index}`;
                    return (
                      <li key={m.index} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
                        <div className="min-w-0 flex-1">
                          <label htmlFor={fieldId} className="block truncate text-[13.5px] font-medium text-orza-strong">
                            {m.header}
                          </label>
                          <div className="truncate text-[12px] text-orza-subtle">{sample ? `e.g. ${sample}` : "Empty column"}</div>
                        </div>
                        <div className="flex w-full gap-2 sm:w-auto">
                          <Select
                            id={fieldId}
                            value={m.field}
                            onChange={(e) => setField(m.index, e.target.value as CsvField)}
                            className="h-10 min-w-0 flex-1 text-[14px] sm:w-[190px] sm:flex-none"
                          >
                            {FIELD_OPTIONS.map((f) => (
                              <option key={f} value={f}>
                                {CSV_FIELD_LABELS[f]}
                              </option>
                            ))}
                          </Select>
                          {units.length > 1 && (
                            <Select
                              aria-label={`Unit for ${m.header}`}
                              value={m.unit}
                              onChange={(e) => setUnit(m.index, e.target.value as CsvUnit)}
                              className="h-10 w-[96px] shrink-0 text-[14px]"
                            >
                              {units.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {dateCol && (
                <div className="max-w-[320px]">
                  <Label htmlFor="csv-date-order">Date format</Label>
                  <Select id="csv-date-order" value={order} onChange={(e) => setOrder(e.target.value as DateOrder | "auto")} className="h-10 text-[14px]">
                    <option value="auto">Detect automatically ({autoOrder === "mdy" ? "month first" : "day first"})</option>
                    <option value="dmy">Day first — 24/09/2026</option>
                    <option value="mdy">Month first — 09/24/2026</option>
                  </Select>
                </div>
              )}

              <section aria-labelledby="csv-preview">
                <h4 id="csv-preview" className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
                  Preview · most recent days
                </h4>
                {problem ? (
                  <div role="alert" className="mt-2 flex items-start gap-2 rounded-orza-sm border border-[rgba(176,106,0,0.22)] bg-[#FFF4E6] p-3 text-[13px] text-[#8A5300]">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {problem}
                  </div>
                ) : (
                  <>
                    <div className="mt-2 overflow-x-auto rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70">
                      <table className="w-full min-w-[420px] text-left text-[13px]">
                        <thead>
                          <tr className="border-b border-[rgba(20,20,20,0.08)] text-[11.5px] text-orza-subtle">
                            <th scope="col" className="px-3 py-2 font-medium">
                              Date
                            </th>
                            {metricsUsed.map((mt) => (
                              <th key={mt} scope="col" className="px-3 py-2 font-medium">
                                {CSV_FIELD_LABELS[mt]}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="tabular-nums">
                          {preview.map((d) => (
                            <tr key={d.date} className="border-b border-[rgba(20,20,20,0.05)] last:border-0">
                              <td className="whitespace-nowrap px-3 py-2 text-orza-strong">{formatDay(d.date, true)}</td>
                              {metricsUsed.map((mt) => (
                                <td key={mt} className="whitespace-nowrap px-3 py-2 text-orza-muted">
                                  {d[mt] !== undefined ? PREVIEW_FORMAT[mt](d[mt] as number) : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {result && (
                      <p className="mt-2 text-[12.5px] text-orza-muted">
                        {formatInt(result.days.length)} days ready ({formatDay(result.days[0].date, true)} – {formatDay(result.days[result.days.length - 1].date, true)})
                        {result.rowsSkipped > 0 && ` · ${formatInt(result.rowsSkipped)} rows skipped (unreadable or future date)`}
                        {result.truncated > 0 && ` · ${formatInt(result.truncated)} older days left out (400-day limit)`}. Values outside a realistic range are ignored.
                      </p>
                    )}
                  </>
                )}
              </section>

              <div className="flex flex-col-reverse gap-2 border-t border-[rgba(20,20,20,0.08)] pt-4 sm:flex-row sm:justify-end">
                <DialogClose asChild>
                  <Button variant="secondary" disabled={saving}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button onClick={save} loading={saving} disabled={!!problem || !result?.days.length}>
                  Import {result?.days.length ? `${formatInt(result.days.length)} days` : ""}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </GlassCard>
  );
}
