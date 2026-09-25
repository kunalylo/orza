"use client";
import * as React from "react";
import { toast } from "sonner";
import { AlarmClockOff, Check, SkipForward } from "lucide-react";
import type { DoseLog } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button, type ButtonSize } from "@/components/ui/button";
import { clockIn, type DoseAction, type DoseItem, type DoseStatusView } from "./shared";

export const SNOOZE_MINUTES = 10;

/** Window event shared with the in-app AlarmWatcher: fired whenever a dose is taken / skipped / snoozed anywhere in the app. */
export const DOSE_UPDATED_EVENT = "orza:dose-updated";

/** Run `fn` when a dose changes elsewhere (the alarm overlay, a notification action, another card). */
export function useDoseUpdates(fn: () => void) {
  const ref = React.useRef(fn);
  React.useEffect(() => {
    ref.current = fn;
  });
  React.useEffect(() => {
    const on = () => ref.current();
    window.addEventListener(DOSE_UPDATED_EVENT, on);
    return () => window.removeEventListener(DOSE_UPDATED_EVENT, on);
  }, []);
}

const keyOf = (d: Pick<DoseItem, "medication_id" | "scheduled_for">) => `${d.medication_id}:${d.scheduled_for}`;

/** The dose after an action, for optimistic UI. */
export function withAction(d: DoseItem, action: DoseAction, log?: Partial<DoseLog>): DoseItem {
  const status: DoseStatusView = action === "take" ? "taken" : action === "skip" ? "skipped" : "snoozed";
  return {
    ...d,
    status,
    acted_at: log?.acted_at || new Date().toISOString(),
    snooze_until: action === "snooze" ? log?.snooze_until || new Date(Date.now() + SNOOZE_MINUTES * 60000).toISOString() : undefined,
  };
}

/**
 * Take / Skip / Snooze a scheduled dose via POST /api/meds/doses, with toasts.
 * `onDone` receives the updated dose so callers can update their lists without refetching.
 */
export function useDoseActions({ tz, onDone, quiet }: { tz: string; onDone?: (updated: DoseItem, action: DoseAction) => void; quiet?: boolean }) {
  const [pending, setPending] = React.useState<Record<string, DoseAction>>({});
  const inflight = React.useRef(new Set<string>());
  const onDoneRef = React.useRef(onDone);
  React.useEffect(() => {
    onDoneRef.current = onDone;
  });

  const act = React.useCallback(
    async (d: DoseItem, action: DoseAction): Promise<boolean> => {
      const key = keyOf(d);
      if (inflight.current.has(key)) return false;
      inflight.current.add(key);
      setPending((p) => ({ ...p, [key]: action }));
      try {
        const res = await api.post<{ dose: DoseLog }>("/meds/doses", {
          medication_id: d.medication_id,
          scheduled_for: d.scheduled_for,
          action,
          ...(action === "snooze" ? { snooze_minutes: SNOOZE_MINUTES } : {}),
        });
        const updated = withAction(d, action, res.dose);
        if (!quiet) {
          if (action === "take") toast.success(`${d.name} — marked as taken`);
          else if (action === "skip") toast.message(`${d.name} — skipped`);
          else toast.message(`Snoozed — we'll remind you again at ${clockIn(tz, new Date(updated.snooze_until!))}`);
        }
        onDoneRef.current?.(updated, action);
        // Let the in-app alarm watcher and other cards refresh (after our own state update).
        setTimeout(() => window.dispatchEvent(new CustomEvent(DOSE_UPDATED_EVENT, { detail: { medication_id: d.medication_id, scheduled_for: d.scheduled_for, action } })), 0);
        return true;
      } catch (e) {
        toast.error(errorMessage(e));
        return false;
      } finally {
        inflight.current.delete(key);
        setPending((p) => {
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
    },
    [tz, quiet]
  );

  const pendingFor = React.useCallback((d: DoseItem): DoseAction | undefined => pending[keyOf(d)], [pending]);
  return { act, pendingFor };
}

/** Take (energy) · Snooze 10 min · Skip. `tone="dark"` for the alarm screen. */
export function DoseActionButtons({
  dose,
  onAct,
  pending,
  size = "sm",
  tone = "light",
  showSnooze = true,
  className,
  autoFocusTake,
}: {
  dose: DoseItem;
  onAct: (action: DoseAction) => void;
  pending?: DoseAction;
  size?: ButtonSize;
  tone?: "light" | "dark";
  showSnooze?: boolean;
  className?: string;
  autoFocusTake?: boolean;
}) {
  const busy = !!pending;
  const who = dose.name;
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        variant="energy"
        size={size}
        loading={pending === "take"}
        disabled={busy}
        onClick={() => onAct("take")}
        aria-label={`Take ${who}`}
        autoFocus={autoFocusTake}
      >
        {pending !== "take" && <Check size={16} aria-hidden />}
        Take
      </Button>
      {showSnooze && (
        <Button
          variant={tone === "dark" ? "hero-outline" : "secondary"}
          size={size}
          loading={pending === "snooze"}
          disabled={busy}
          onClick={() => onAct("snooze")}
          aria-label={`Snooze ${who} for ${SNOOZE_MINUTES} minutes`}
        >
          {pending !== "snooze" && <AlarmClockOff size={15} aria-hidden />}
          Snooze {SNOOZE_MINUTES} min
        </Button>
      )}
      <Button
        variant="ghost"
        size={size}
        loading={pending === "skip"}
        disabled={busy}
        onClick={() => onAct("skip")}
        aria-label={`Skip ${who}`}
        className={tone === "dark" ? "text-white/70 hover:bg-white/10 hover:text-white" : undefined}
      >
        {pending !== "skip" && <SkipForward size={15} aria-hidden />}
        Skip
      </Button>
    </div>
  );
}
