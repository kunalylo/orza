"use client";
import * as React from "react";
import { Flag, Mail } from "lucide-react";
import { toast } from "sonner";
import { KIND_LABEL, REASON_LABEL } from "@/components/ai/report-copy";
import { formatDate, formatDateTime, Switch } from "@/components/account/ui";
import { Eyebrow, GlassCard, Tag, type TagTone } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Segmented, Skeleton } from "@/components/ui/form";
import type { AiReportReason } from "@/lib/ai-report-shared";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import type { AdminAiReport, AdminAiReportsResponse, AiReportsStatus } from "./types";

const REASON_TONE: Record<AiReportReason, TagTone> = { offensive: "danger", unsafe: "warning", wrong: "info", other: "neutral" };

const FILTERS: { value: AiReportsStatus; label: string }[] = [
  { value: "open", label: "To review" },
  { value: "reviewed", label: "Reviewed" },
  { value: "all", label: "All" },
];

const EMPTY: Record<AiReportsStatus, string> = {
  open: "Nothing to review — you’re all caught up.",
  reviewed: "No reviewed reports yet.",
  all: "No reports yet.",
};

/**
 * Members' reports of AI output (Google Play's AI-Generated Content policy), newest first: what they were shown, why they
 * reported it and their note, with a Reviewed switch. A switched row stays in the list until the filter changes, so a
 * slip can be undone.
 */
export function AiReportsCard() {
  const [status, setStatus] = React.useState<AiReportsStatus>("open");
  const [reports, setReports] = React.useState<AdminAiReport[] | null>(null);
  const [open, setOpen] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const reqId = React.useRef(0);

  const load = React.useCallback(async (which: AiReportsStatus) => {
    const id = ++reqId.current;
    setError(null);
    setReports(null);
    try {
      const res = await api.get<AdminAiReportsResponse>(`/admin/ai-reports?status=${which}`);
      if (id !== reqId.current) return;
      setReports(res.reports);
      setOpen(res.open);
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    load(status);
  }, [load, status]);

  async function setReviewed(r: AdminAiReport, reviewed: boolean) {
    setSaving(r.id);
    try {
      await api.patch(`/admin/ai-reports/${encodeURIComponent(r.id)}`, { reviewed });
      setReports((list) =>
        list && list.map((x) => (x.id === r.id ? { ...x, reviewed, reviewed_at: reviewed ? new Date().toISOString() : null } : x))
      );
      setOpen((n) => (n == null ? n : Math.max(0, n + (reviewed ? -1 : 1))));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <GlassCard as="section" aria-labelledby="admin-ai-reports-title" variant="strong">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow className="text-[11px]">Moderation</Eyebrow>
          <h2 id="admin-ai-reports-title" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
            Reports
          </h2>
          <p className="mt-1 text-[13px] text-orza-muted">Newest first. A report the member changes comes back to review.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {open != null && open > 0 && (
            <Tag tone="warning" size="sm">
              {formatNumber(open)} to review
            </Tag>
          )}
          <Segmented<AiReportsStatus> value={status} onChange={setStatus} options={FILTERS} size="sm" aria-label="Show reports" />
        </div>
      </div>

      {error && !reports ? (
        <div role="alert" className="mt-5 flex flex-col items-start gap-3 rounded-orza-sm border border-[rgba(176,44,44,0.20)] bg-[#FDECEC]/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[#B02C2C]">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => load(status)}>
            Try again
          </Button>
        </div>
      ) : !reports ? (
        <div className="mt-5 flex flex-col gap-2.5" aria-busy="true" aria-label="Loading reports">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-orza-sm" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.12)] bg-white/40 px-4 py-4 text-[13px] text-orza-muted">
          <Flag size={18} strokeWidth={1.75} className="shrink-0 text-orza-subtle" aria-hidden />
          {EMPTY[status]}
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2.5" aria-label="Reports, newest first">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} saving={saving === r.id} disabled={!!saving && saving !== r.id} onReviewed={(v) => setReviewed(r, v)} />
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function ReportRow({
  report: r,
  saving,
  disabled,
  onReviewed,
}: {
  report: AdminAiReport;
  saving: boolean;
  disabled: boolean;
  onReviewed: (reviewed: boolean) => void;
}) {
  const who = r.member?.name || "Member";
  const kind = KIND_LABEL[r.kind] ?? r.kind;
  const switchId = `ai-report-${r.id}`;
  return (
    <li className="rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-[14px] font-medium text-orza-strong">{kind}</span>
          <Tag tone={REASON_TONE[r.reason] ?? "neutral"} size="sm">
            {REASON_LABEL[r.reason] ?? r.reason}
          </Tag>
          {!r.ai && (
            <Tag tone="neutral" size="sm" dot={false}>
              Built-in
            </Tag>
          )}
        </div>
        <label htmlFor={switchId} className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] text-orza-muted">
          Reviewed
          <Switch
            id={switchId}
            checked={r.reviewed}
            onCheckedChange={onReviewed}
            disabled={saving || disabled}
            aria-label={`Reviewed: ${kind} reported by ${who}`}
          />
        </label>
      </div>

      {r.note && <p className="mt-2 whitespace-pre-line break-words text-[13.5px] leading-relaxed text-orza-strong">&ldquo;{r.note}&rdquo;</p>}

      <div
        tabIndex={0}
        role="region"
        aria-label={`What ${who} was shown`}
        className="mt-2.5 max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-orza-xs border border-[rgba(20,20,20,0.08)] bg-white/80 px-3 py-2.5 text-[13px] leading-relaxed text-orza-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
      >
        {r.text}
      </div>

      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] text-orza-subtle">
        <span>
          Reported <time dateTime={r.updated_at}>{formatDateTime(r.updated_at)}</time>
          {r.updated_at !== r.created_at && (
            <>
              {" · first "}
              <time dateTime={r.created_at} title={formatDateTime(r.created_at)}>
                {formatDate(r.created_at)}
              </time>
            </>
          )}
          {` · ${r.client === "app" ? "app" : "website"}`}
        </span>
        <span aria-hidden>·</span>
        {r.member ? (
          <a
            href={`mailto:${r.member.email}?subject=${encodeURIComponent("Your report to ÖRZA")}`}
            className="inline-flex min-w-0 items-center gap-1 truncate underline-offset-2 hover:text-orza-strong hover:underline"
          >
            <Mail size={12} strokeWidth={1.75} aria-hidden />
            <span className="truncate">
              {who} · {r.member.email}
            </span>
          </a>
        ) : (
          <span>account deleted</span>
        )}
      </div>
    </li>
  );
}
