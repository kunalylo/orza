"use client";
import * as React from "react";
import { Footprints } from "lucide-react";
import { toast } from "sonner";
import { Bar, GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { FieldHint, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api-client";
import type { TrackingDay } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { BigNumber, TrackerHead } from "./parts";
import type { TrackingResponse } from "./types";

const MAX_STEPS = 100000;

export function StepsCard({
  date,
  isToday,
  steps,
  target,
  onSaved,
}: {
  date: string;
  isToday: boolean;
  steps: number;
  target: number;
  onSaved: (t: TrackingDay) => void;
}) {
  const [input, setInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputId = React.useId();
  const hintId = React.useId();
  const pct = target > 0 ? Math.round((steps / target) * 100) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(input.replace(/[,\s]/g, ""));
    if (!input.trim() || !Number.isFinite(n) || n < 0 || n > MAX_STEPS) {
      toast.error(`Enter a step count between 0 and ${formatNumber(MAX_STEPS)}.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<TrackingResponse>("/track/steps", { steps: Math.round(n), date });
      onSaved(res.tracking);
      setInput("");
      toast.success(`${formatNumber(res.tracking.steps)} steps saved`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard className="flex h-full flex-col">
      <TrackerHead
        icon={<Footprints size={17} strokeWidth={1.75} aria-hidden />}
        tone="energy"
        label="Steps"
        right={<span className="tabular-nums">{pct}%</span>}
      />

      <BigNumber className="mt-4" value={formatNumber(steps)} caption={`of ${formatNumber(target)} steps`} />
      <Bar value={steps} max={target} tone="energy" className="mt-4" />
      <p className="mt-2 text-xs text-orza-subtle">
        {steps >= target && target > 0
          ? "Step goal reached — lovely work."
          : steps > 0
            ? `${formatNumber(target - steps)} more to reach your goal.`
            : isToday
              ? "A short walk after meals is a great place to start."
              : "No steps were logged on this day."}
      </p>

      <form onSubmit={submit} className="mt-auto pt-5" noValidate>
        <label htmlFor={inputId} className="sr-only">
          Total steps {isToday ? "today" : "for this day"}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_STEPS}
            step={1}
            placeholder={steps > 0 ? formatNumber(steps) : "e.g. 6500"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-describedby={hintId}
            className="h-10"
          />
          <Button type="submit" variant="secondary" loading={saving} disabled={!input.trim()} className="shrink-0">
            Save
          </Button>
        </div>
        <FieldHint id={hintId}>Enter the total from your phone or watch.</FieldHint>
      </form>
    </GlassCard>
  );
}
