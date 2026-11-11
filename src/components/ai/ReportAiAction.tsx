"use client";
import * as React from "react";
import { Flag, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FieldHint, Label, Textarea } from "@/components/ui/form";
import { AI_REPORT_NOTE_MAX as MAX, type AiReportKind, type AiReportReason } from "@/lib/ai-report-shared";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { REPORT_COPY, REPORT_REASONS, reportHint, reportTitle } from "./report-copy";

/** Items reported during this visit (`kind:id`), so a trigger still says "Reported" after its card re-mounts. */
const reportedThisVisit = new Set<string>();

/**
 * "Report" on an AI output the member was shown (Google Play's AI-Generated Content policy; docs/notes/ai-report.md in
 * the mobile repo): a trigger and a short dialog — one reason, an optional note — that sends POST /api/ai/reports.
 * Reporting the same item again replaces the earlier report, so the trigger stays usable after "Reported".
 * `look="quiet"` is the small text button under a chat reply; `look="button"` a ghost button in an action row.
 */
export function ReportAiAction({
  kind,
  refId,
  look = "quiet",
  className,
}: {
  kind: AiReportKind;
  refId: string;
  look?: "quiet" | "button";
  className?: string;
}) {
  const key = `${kind}:${refId}`;
  const [open, setOpen] = React.useState(false);
  const [reported, setReported] = React.useState(() => reportedThisVisit.has(key));
  const [reason, setReason] = React.useState<AiReportReason | null>(null);
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const idBase = React.useId();
  const title = reportTitle(kind);

  React.useEffect(() => {
    setReported(reportedThisVisit.has(key));
  }, [key]);

  function onOpenChange(next: boolean) {
    if (sending) return;
    if (next) {
      setReason(null);
      setNote("");
      setError(null);
    }
    setOpen(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || sending) return;
    const text = note.trim();
    setSending(true);
    setError(null);
    try {
      await api.post("/ai/reports", { kind, ref_id: refId, reason, ...(text ? { note: text } : {}) });
      reportedThisVisit.add(key);
      setReported(true);
      setOpen(false);
      toast.success(REPORT_COPY.sentTitle, { description: REPORT_COPY.sentBody });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const label = reported ? REPORT_COPY.reportedLabel : title;
  const icon = <Flag size={look === "quiet" ? 13 : 15} strokeWidth={1.9} aria-hidden className={cn(reported && "fill-current")} />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {look === "quiet" ? (
          <button
            type="button"
            aria-label={label}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-orza-subtle transition-colors duration-150 ease-orza hover:bg-white/70 hover:text-orza-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan",
              reported && "text-orza-muted",
              className
            )}
          >
            {icon}
            {reported ? REPORT_COPY.reported : REPORT_COPY.trigger}
          </button>
        ) : (
          <Button variant="ghost" aria-label={label} className={className}>
            {icon}
            {reported ? REPORT_COPY.reported : REPORT_COPY.trigger}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={title} description={REPORT_COPY.lead}>
        <form onSubmit={submit} noValidate>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-orza-strong">{REPORT_COPY.question}</legend>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70 px-3.5 py-2.5 text-[14.5px] text-orza-strong transition-colors duration-150 ease-orza hover:bg-white has-[:checked]:border-orza-cyan has-[:checked]:bg-white has-[:focus-visible]:shadow-[0_0_0_3px_rgba(11,190,220,0.18)]"
                >
                  <input
                    type="radio"
                    name={`${idBase}-reason`}
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    disabled={sending}
                    className="h-4 w-4 shrink-0 accent-[#0B8FA6]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4">
            <Label htmlFor={`${idBase}-note`}>{REPORT_COPY.noteLabel}</Label>
            <Textarea
              id={`${idBase}-note`}
              value={note}
              maxLength={MAX}
              onChange={(e) => setNote(e.target.value)}
              disabled={sending}
              className="min-h-[80px]"
              aria-describedby={`${idBase}-hint`}
            />
            <FieldHint id={`${idBase}-hint`} className="flex justify-between gap-3">
              <span>{reportHint(kind)}</span>
              <span className="tabular-nums">
                {note.length}/{MAX}
              </span>
            </FieldHint>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" disabled={sending}>
                {REPORT_COPY.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={sending} disabled={!reason}>
              {!sending && <Send size={15} strokeWidth={1.75} aria-hidden />}
              {REPORT_COPY.send}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
