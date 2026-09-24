"use client";
import * as React from "react";
import { GlassWater, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import type { TrackingDay } from "@/lib/types";
import { clamp, cn } from "@/lib/utils";
import { BigNumber, TrackerHead } from "./parts";
import type { TrackingResponse } from "./types";

const MAX_GLASSES = 40;
const MAX_SLOTS = 16;

/**
 * Water tracker with optimistic updates. Each change sets the day's absolute count, so writes
 * are serialised: at most one request is in flight, and taps made meanwhile collapse into a
 * single follow-up write of the latest value. The server therefore always ends on what the
 * card shows. A failure rolls back to the last confirmed value and asks the parent to re-sync.
 */
export function WaterCard({
  date,
  glasses,
  target,
  onSaved,
  onResync,
}: {
  date: string;
  glasses: number;
  target: number;
  onSaved: (t: TrackingDay) => void;
  onResync: () => void;
}) {
  const [value, setValue] = React.useState(glasses);
  const confirmed = React.useRef(glasses);
  const busy = React.useRef(false);
  const queued = React.useRef<number | null>(null);
  // Latest callbacks, so a write chain that outlives a render (or the card) reports to the current parent.
  const callbacks = React.useRef({ onSaved, onResync });
  React.useEffect(() => {
    callbacks.current = { onSaved, onResync };
  }, [onSaved, onResync]);

  React.useEffect(() => {
    confirmed.current = glasses;
    if (!busy.current) setValue(glasses);
  }, [glasses, date]);

  const send = (n: number) => {
    busy.current = true;
    api
      .post<TrackingResponse>("/track/water", { glasses: n, date })
      .then(
        (res) => {
          confirmed.current = res.tracking.water_glasses;
          if (queued.current == null) callbacks.current.onSaved(res.tracking);
        },
        (e) => {
          // A newer value is about to be written; its outcome decides what the card shows.
          if (queued.current != null) return;
          setValue(confirmed.current);
          toast.error(errorMessage(e));
          callbacks.current.onResync();
        }
      )
      .finally(() => {
        const next = queued.current;
        queued.current = null;
        if (next != null) send(next);
        else busy.current = false;
      });
  };

  const commit = (next: number) => {
    const n = clamp(Math.round(next), 0, MAX_GLASSES);
    if (n === value) return;
    setValue(n);
    if (busy.current) queued.current = n;
    else send(n);
  };

  const slots = Math.min(Math.max(target, value), MAX_SLOTS);
  const extra = value - slots;
  const done = target > 0 && value >= target;

  return (
    <GlassCard className="flex h-full flex-col">
      <TrackerHead
        icon={<GlassWater size={17} strokeWidth={1.75} aria-hidden />}
        tone="cyan"
        label="Water"
        right={<span className="tabular-nums">{formatMl(value * 250)}</span>}
      />

      <BigNumber className="mt-4" value={<span aria-live="polite">{value}</span>} caption={`of ${target} glasses`} />

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Glasses of water — tap to set">
        {Array.from({ length: slots }, (_, i) => {
          const filled = i < value;
          // Tapping the last filled glass empties it; any other glass fills up to it.
          const nextValue = filled && i + 1 === value ? i : i + 1;
          return (
            <button
              key={i}
              type="button"
              onClick={() => commit(nextValue)}
              aria-label={`Set water to ${nextValue} glass${nextValue === 1 ? "" : "es"}`}
              aria-pressed={filled}
              className={cn(
                "inline-flex h-9 w-8 items-center justify-center rounded-[10px] border",
                "transition-[background-color,border-color,color,transform] duration-150 ease-orza active:scale-95",
                filled
                  ? "border-[rgba(11,190,220,0.30)] bg-[#E8FBFF] text-[#0B8FA6]"
                  : "border-[rgba(20,20,20,0.08)] bg-white/50 text-[rgba(20,20,20,0.22)] hover:border-[rgba(11,190,220,0.25)] hover:text-[#0B8FA6]/70"
              )}
            >
              <GlassWater size={16} strokeWidth={1.75} fill={filled ? "rgba(47,210,240,0.28)" : "none"} aria-hidden />
            </button>
          );
        })}
        {extra > 0 && (
          <span className="inline-flex h-9 items-center rounded-[10px] border border-[rgba(11,190,220,0.30)] bg-[#E8FBFF] px-2 text-xs font-medium text-[#0B8FA6]">
            +{extra}
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <span className={cn("text-xs", done ? "font-medium text-[#127A56]" : "text-orza-subtle")}>
          {done ? "Hydration goal reached" : `${Math.max(0, target - value)} to go · 250 ml each`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9"
            aria-label="Remove a glass"
            disabled={value <= 0}
            onClick={() => commit(value - 1)}
          >
            <Minus size={15} strokeWidth={2} aria-hidden />
          </Button>
          <Button
            variant="primary"
            size="icon"
            className="h-9 w-9"
            aria-label="Add a glass"
            disabled={value >= MAX_GLASSES}
            onClick={() => commit(value + 1)}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

const formatMl = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace(/0$/, "")} L` : `${ml} ml`);
