"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Maximize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { MedPhoto } from "./MedPhoto";
import { DoseActionButtons } from "./useDoseActions";
import {
  alarmHref,
  clockIn,
  formatTime12,
  medicineTitle,
  STATUS_META,
  TIMING_LABEL,
  type DoseAction,
  type DoseItem,
} from "./shared";

export function TimelineSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-5 w-14" />
          <div className="flex flex-1 gap-3 rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/50 p-3">
            <Skeleton className="h-16 w-16 shrink-0 !rounded-orza-sm" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-24 !rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function statusDetail(d: DoseItem, tz: string): string {
  if (d.status === "taken" && d.acted_at) return `Taken at ${clockIn(tz, new Date(d.acted_at))}`;
  if (d.status === "skipped") return "Skipped";
  if (d.status === "snoozed" && d.snooze_until) return `Snoozed until ${clockIn(tz, new Date(d.snooze_until))}`;
  return STATUS_META[d.status].label;
}

function DoseRow({
  dose,
  tz,
  pending,
  onAct,
}: {
  dose: DoseItem;
  tz: string;
  pending?: DoseAction;
  onAct: (d: DoseItem, a: DoseAction) => void;
}) {
  const meta = STATUS_META[dose.status];
  const done = dose.status === "taken" || dose.status === "skipped";
  const needsAction = dose.status === "due" || dose.status === "missed" || dose.status === "snoozed";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-orza-md border p-3 transition-colors duration-220 ease-orza sm:flex-row sm:items-center sm:p-3.5",
        dose.status === "due"
          ? "border-[rgba(255,122,106,0.40)] bg-[linear-gradient(135deg,rgba(255,241,234,0.95),rgba(255,255,255,0.75))] shadow-orza-glass"
          : "border-[rgba(20,20,20,0.08)] bg-white/60",
        done && "opacity-80"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative shrink-0">
          <MedPhoto
            src={dose.photo_urls[0]}
            alt={medicineTitle(dose)}
            className="h-16 w-16 rounded-orza-sm border border-[rgba(20,20,20,0.08)] sm:h-[72px] sm:w-[72px]"
          />
          {dose.status === "taken" && (
            <span className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#127A56] text-white" aria-hidden>
              <Check size={13} strokeWidth={3} />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-[15px] font-semibold text-orza-strong", dose.status === "skipped" && "line-through decoration-orza-subtle")}>
            {medicineTitle(dose)}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-orza-muted">{dose.dose}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Tag tone={meta.tone} size="sm">
              {statusDetail(dose, tz)}
            </Tag>
            {dose.timing !== "any" && (
              <Tag tone="warning" size="sm" dot={false}>
                {TIMING_LABEL[dose.timing]}
              </Tag>
            )}
            {dose.for_person && (
              <Tag tone="violet" size="sm" dot={false}>
                For {dose.for_person}
              </Tag>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:justify-end">
        {needsAction && <DoseActionButtons dose={dose} pending={pending} onAct={(a) => onAct(dose, a)} />}
        {dose.status === "upcoming" && (
          <Button variant="secondary" size="sm" loading={pending === "take"} disabled={!!pending} onClick={() => onAct(dose, "take")} aria-label={`Mark ${dose.name} as taken now`}>
            {pending !== "take" && <Check size={15} aria-hidden />}
            Taken early
          </Button>
        )}
        {dose.status === "skipped" && (
          <Button variant="secondary" size="sm" loading={pending === "take"} disabled={!!pending} onClick={() => onAct(dose, "take")} aria-label={`Take ${dose.name} after all`}>
            {pending !== "take" && <RotateCcw size={14} aria-hidden />}
            Take after all
          </Button>
        )}
        {(dose.status === "due" || dose.status === "snoozed") && (
          <Link
            href={alarmHref(dose)}
            className="hidden h-9 w-9 items-center justify-center rounded-full text-orza-muted transition-colors hover:bg-white hover:text-orza-strong sm:inline-flex"
            aria-label={`Open the full-screen alarm for ${dose.name}`}
            title="Open full-screen alarm"
          >
            <Maximize2 size={15} aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

/** Today's doses grouped by time, with Take / Snooze / Skip. */
export function TodayTimeline({
  doses,
  tz,
  pendingFor,
  onAct,
}: {
  doses: DoseItem[];
  tz: string;
  pendingFor: (d: DoseItem) => DoseAction | undefined;
  onAct: (d: DoseItem, a: DoseAction) => void;
}) {
  const groups = React.useMemo(() => {
    const map = new Map<string, DoseItem[]>();
    for (const d of doses) {
      const list = map.get(d.local_time) || [];
      list.push(d);
      map.set(d.local_time, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [doses]);

  return (
    <ol className="relative space-y-5" aria-label="Today's doses">
      {groups.map(([time, list], gi) => {
        const [clock, suffix] = formatTime12(time).split(" ");
        const allDone = list.every((d) => d.status === "taken" || d.status === "skipped");
        const anyDue = list.some((d) => d.status === "due");
        return (
          <li key={time} className="relative grid grid-cols-[44px_1fr] gap-2.5 sm:grid-cols-[68px_1fr] sm:gap-4">
            {gi < groups.length - 1 && <span className="absolute bottom-[-20px] left-[21px] top-7 w-px bg-[rgba(20,20,20,0.10)] sm:left-[33px]" aria-hidden />}
            <div className="relative flex flex-col items-center pt-1 text-center">
              <span
                className={cn(
                  "relative z-[1] mb-1 h-3 w-3 rounded-full border-2 border-orza-bg-0",
                  allDone ? "bg-[#127A56]" : anyDue ? "bg-[#FF7A6A] shadow-[0_0_0_4px_rgba(255,122,106,0.18)]" : "bg-[rgba(20,20,20,0.25)]"
                )}
                aria-hidden
              />
              <span className="font-editorial text-[16px] font-semibold leading-tight text-orza-strong tabular-nums sm:text-[20px]">{clock}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{suffix}</span>
            </div>
            <ul className="min-w-0 space-y-2.5" aria-label={`Doses at ${formatTime12(time)}`}>
              {list.map((d) => (
                <DoseRow key={`${d.medication_id}:${d.scheduled_for}`} dose={d} tz={tz} pending={pendingFor(d)} onAct={onAct} />
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
