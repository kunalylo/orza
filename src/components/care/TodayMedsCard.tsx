"use client";
import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Pill, Plus, RefreshCw, ScanLine } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { DEFAULT_TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/app/UserProvider";
import { GlassCard, Tag } from "@/components/orza/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { MedPhoto } from "@/components/care/meds/MedPhoto";
import { useDoseActions, useDoseUpdates } from "@/components/care/meds/useDoseActions";
import {
  alarmHref,
  attentionRank,
  clockIn,
  formatTime12,
  isOpen,
  medicineTitle,
  STATUS_META,
  todayIn,
  type DoseItem,
  type TodayResponse,
} from "@/components/care/meds/shared";

const SHOW = 3;

/** Today dashboard card: the next medicine doses with photo thumbnails and a quick Take. */
export function TodayMedsCard() {
  const { user } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const [date, setDate] = React.useState(() => todayIn(tz));
  const [data, setData] = React.useState<TodayResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (silent = false) => {
      if (!silent) setError(null);
      try {
        setData(await api.get<TodayResponse>(`/meds/today?date=${date}`));
        setError(null);
      } catch (e) {
        if (!silent) setError(errorMessage(e));
      }
    },
    [date]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const t = setInterval(() => {
      const now = todayIn(tz);
      if (now !== date) setDate(now);
      else if (document.visibilityState === "visible") load(true);
    }, 60000);
    return () => clearInterval(t);
  }, [tz, date, load]);

  const { act, pendingFor } = useDoseActions({
    tz,
    onDone: (updated) =>
      setData((d) =>
        d ? { ...d, doses: d.doses.map((x) => (x.medication_id === updated.medication_id && x.scheduled_for === updated.scheduled_for ? updated : x)) } : d
      ),
  });

  useDoseUpdates(() => load(true));

  const doses = data?.doses ?? [];
  const taken = doses.filter((d) => d.status === "taken").length;
  const open = doses
    .filter(isOpen)
    .sort((a, b) => Math.min(attentionRank(a.status), 3) - Math.min(attentionRank(b.status), 3) || a.scheduled_for.localeCompare(b.scheduled_for));
  const shown = open.slice(0, SHOW);
  const pct = doses.length ? Math.round((taken / doses.length) * 100) : 0;

  return (
    <GlassCard as="section" aria-labelledby="today-meds-title" padded={false} className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Medicines</div>
          <h2 id="today-meds-title" className="mt-1 font-editorial text-[19px] font-semibold text-orza-strong">
            {open.length ? "Next doses" : "Today's doses"}
          </h2>
        </div>
        <Link href="/dashboard/medicines" className="inline-flex items-center gap-0.5 text-[13px] font-medium text-orza-muted hover:text-orza-strong">
          All <ChevronRight size={14} aria-hidden />
        </Link>
      </div>

      {!data && !error ? (
        <div className="mt-4 space-y-3" aria-busy aria-label="Loading medicines">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0 !rounded-orza-sm" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-9 w-20 !rounded-full" />
            </div>
          ))}
        </div>
      ) : error && !data ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px] text-orza-muted" role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => load()}>
            <RefreshCw size={13} aria-hidden /> Retry
          </Button>
        </div>
      ) : !doses.length ? (
        <div className="mt-4">
          <p className="text-[13px] leading-relaxed text-orza-muted">
            No medicines scheduled today. Add yours and every alarm shows the medicine&apos;s photo — or scan a prescription and ÖRZA sets them up.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href="/dashboard/medicines?add=1" variant="secondary" size="sm">
              <Plus size={14} aria-hidden /> Add medicine
            </ButtonLink>
            <ButtonLink href="/dashboard/medicines/prescriptions" variant="ghost" size="sm">
              <ScanLine size={14} aria-hidden /> Scan prescription
            </ButtonLink>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between text-[12px] text-orza-muted">
              <span>
                <span className="font-semibold text-orza-strong">{taken}</span> of {doses.length} taken today
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(20,20,20,0.08)]" aria-hidden>
              <div className="h-full rounded-full bg-orza-energy transition-[width] duration-500 ease-orza" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="mt-4 flex items-center gap-2.5 rounded-orza-sm bg-[#EAF7F1] px-3 py-2.5 text-[13px] font-medium text-[#127A56]">
              <CheckCircle2 size={17} aria-hidden />
              All done for today — nicely handled.
            </div>
          ) : (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((d: DoseItem) => {
                const meta = STATUS_META[d.status];
                const pending = pendingFor(d);
                const quickTake = d.status === "due" || d.status === "missed" || d.status === "snoozed";
                return (
                  <li
                    key={`${d.medication_id}:${d.scheduled_for}`}
                    className={cn(
                      "flex items-center gap-3 rounded-orza-sm p-1.5",
                      d.status === "due" && "bg-[linear-gradient(135deg,rgba(255,241,234,0.9),rgba(255,255,255,0.5))]"
                    )}
                  >
                    <Link href={alarmHref(d)} className="shrink-0 rounded-orza-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan" aria-label={`Open the alarm for ${d.name}`}>
                      <MedPhoto src={d.photo_urls[0]} alt={medicineTitle(d)} iconSize={18} className="h-12 w-12 rounded-orza-sm border border-[rgba(20,20,20,0.08)]" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-orza-strong">{medicineTitle(d)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-orza-muted">
                        <span className="tabular-nums">{formatTime12(d.local_time)}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{d.dose}</span>
                        {d.status !== "upcoming" && (
                          <Tag tone={meta.tone} size="sm">
                            {d.status === "snoozed" && d.snooze_until ? `Until ${clockIn(tz, new Date(d.snooze_until))}` : meta.label}
                          </Tag>
                        )}
                      </div>
                    </div>
                    {quickTake ? (
                      <Button variant="energy" size="sm" onClick={() => act(d, "take")} loading={pending === "take"} disabled={!!pending} aria-label={`Take ${d.name}`}>
                        Take
                      </Button>
                    ) : (
                      <span className="inline-flex h-9 items-center text-orza-subtle" aria-hidden>
                        <Pill size={15} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {open.length > SHOW && (
            <Link href="/dashboard/medicines" className="mt-3 inline-block text-[12px] font-medium text-orza-muted hover:text-orza-strong">
              +{open.length - SHOW} more today
            </Link>
          )}
        </>
      )}
    </GlassCard>
  );
}
