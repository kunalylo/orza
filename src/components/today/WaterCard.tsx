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
 * Water tracker with optimistic updates. Each change posts the absolute count;
 * only the latest request's response is applied, and a failure rolls back to the
 * last confirmed value and asks the parent to re-sync.
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
  const seq = React.useRef(0);
  const inFlight = React.useRef(0);

  React.useEffect(() => {
    confirmed.current = glasses;
    if (inFlight.current === 0) setValue(glasses);
  }, [glasses, date]);

  const commit = (next: number) => {
    const n = clamp(Math.round(next), 0, MAX_GLASSES);
    if (n === value) return;
    setValue(n);
    const s = ++seq.current;
    inFlight.current++;
    api
      .post<TrackingResponse>("/track/water", { glasses: n, date })
      .then((res) => {
        confirmed.current = res.tracking.water_glasses;
        if (s === seq.current) onSaved(res.tracking);
      })
      .catch((e) => {
        if (s !== seq.current) return;
        setValue(confirmed.current);
        toast.error(errorMessage(e));
        onResync();
      })
      .finally(() => {
        inFlight.current--;
      });
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
