"use client";
import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, FileArchive, Lock, Upload, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Bar, GlassCard, IconTile } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { AppleHealthImportError, importAppleHealthExport, type AppleImportProgress } from "./appleHealthImport";
import { Step, Steps, Ui } from "./HealthUi";
import { formatBytes, formatDay, formatInt } from "./format";
import type { HealthWriteResponse } from "./metrics";

type State =
  | { phase: "idle" }
  | { phase: "reading"; fileName: string; progress: AppleImportProgress }
  | { phase: "uploading"; fileName: string; days: number }
  | { phase: "done"; days: number; since: string; until: string }
  | { phase: "error"; message: string };

/** iPhone: import Apple Health's export.zip, parsed on this device; only daily totals are uploaded. */
export function AppleImportCard({ tz, onImported }: { tz: string; onImported: () => void }) {
  const [state, setState] = React.useState<State>({ phase: "idle" });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const busy = state.phase === "reading" || state.phase === "uploading";

  // Leaving the page mid-import would throw the work away — ask first.
  React.useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  const run = async (file: File) => {
    const ac = new AbortController();
    abortRef.current = ac;
    setState({ phase: "reading", fileName: file.name, progress: { bytesRead: 0, totalBytes: file.size, records: 0 } });
    try {
      const result = await importAppleHealthExport(file, {
        tz,
        signal: ac.signal,
        onProgress: (progress) => setState((s) => (s.phase === "reading" ? { ...s, progress } : s)),
      });
      if (ac.signal.aborted) return;
      setState({ phase: "uploading", fileName: file.name, days: result.days.length });
      const res = await api.post<HealthWriteResponse>("/health/import", { source: "apple_health", days: result.days });
      setState({ phase: "done", days: res.days_updated, since: result.days[0].date, until: result.days[result.days.length - 1].date });
      toast.success(`Imported ${formatInt(res.days_updated)} days from Apple Health.`);
      onImported();
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof DOMException && e.name === "AbortError") {
        setState({ phase: "idle" });
        toast("Import cancelled.");
        return;
      }
      const message = e instanceof AppleHealthImportError ? e.message : errorMessage(e);
      setState({ phase: "error", message });
      toast.error(message);
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  };

  const choose = () => inputRef.current?.click();

  return (
    <GlassCard className="flex flex-col" id="apple-import">
      <div className="flex items-start gap-3">
        <IconTile tone="energy">
          <FileArchive className="h-5 w-5" aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <h3 className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">Import from Apple Health</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-orza-muted">
            Bring in the last 12 months of steps, active energy, distance, sleep, heart rate, weight and water in one go.
          </p>
        </div>
      </div>

      <Steps className="mt-5">
        <Step n={1} title="Export from the Health app">
          On your iPhone open <Ui>Health</Ui>, tap your profile picture (top right), then <Ui>Export All Health Data</Ui> →{" "}
          <Ui>Export</Ui>. Large histories can take a few minutes.
        </Step>
        <Step n={2} title="Get the zip to this device">
          Save <Ui>export.zip</Ui> to Files, or AirDrop / email it to your computer. On this iPhone you can pick it straight from Files.
        </Step>
        <Step n={3} title="Choose it here">
          ÖRZA reads the file on this device and uploads only daily totals — the export itself never leaves your device.
        </Step>
      </Steps>

      <input
        ref={inputRef}
        type="file"
        accept=".zip,.xml,application/zip,application/x-zip-compressed,application/xml,text/xml"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void run(f);
        }}
      />

      <div className="mt-5">
        {state.phase === "reading" && (
          <div className="rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium text-orza-strong">Reading {state.fileName}</div>
                <div className="mt-0.5 text-[12px] tabular-nums text-orza-muted">
                  {formatBytes(state.progress.bytesRead)} of {formatBytes(state.progress.totalBytes)} · {formatInt(state.progress.records)} records found
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => abortRef.current?.abort()}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </Button>
            </div>
            <div
              className="mt-3"
              role="progressbar"
              aria-label="Apple Health import progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((state.progress.bytesRead / Math.max(1, state.progress.totalBytes)) * 100)}
            >
              <Bar value={state.progress.bytesRead} max={Math.max(1, state.progress.totalBytes)} />
            </div>
            <p className="mt-2 text-[12px] text-orza-subtle">Keep this tab open. A 1 GB export usually takes a minute or two.</p>
          </div>
        )}
        {state.phase === "uploading" && (
          <div role="status" className="flex items-center gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70 p-4 text-[13.5px] text-orza-strong">
            <Upload className="h-4 w-4 animate-pulse text-orza-muted" aria-hidden />
            Saving {formatInt(state.days)} days to ÖRZA…
          </div>
        )}
        {state.phase === "done" && (
          <div role="status" className="flex items-start gap-3 rounded-orza-sm border border-[rgba(18,122,86,0.22)] bg-[#EAF7F1] p-4 text-[13.5px] text-[#0F5E43]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Imported {formatInt(state.days)} days ({formatDay(state.since, true)} – {formatDay(state.until, true)}). Import a fresh export any time — days
              are updated, not duplicated.
            </span>
          </div>
        )}
        {state.phase === "error" && (
          <div role="alert" className="flex items-start gap-3 rounded-orza-sm border border-[rgba(176,44,44,0.22)] bg-[#FDECEC] p-4 text-[13.5px] text-[#8F2323]">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{state.message}</span>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-orza-subtle">
          <Lock className="h-3.5 w-3.5" aria-hidden />
          Processed on this device
        </span>
        <Button onClick={choose} disabled={busy} variant={state.phase === "done" ? "secondary" : "primary"}>
          <FileArchive className="h-4 w-4" aria-hidden />
          {state.phase === "done" ? "Import another export" : state.phase === "error" ? "Choose the file again" : "Choose export.zip"}
        </Button>
      </div>
    </GlassCard>
  );
}
