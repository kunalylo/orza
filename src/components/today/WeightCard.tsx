"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Scale } from "lucide-react";
import { toast } from "sonner";
import { Bar, GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { FieldHint, Input } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api-client";
import type { Goal, PublicUser, TrackingDay } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { BigNumber, TrackerHead } from "./parts";
import { displayToKg, kgToDisplay, relativeDay } from "./format";

const MIN_KG = 20;
const MAX_KG = 400;

export function WeightCard({
  date,
  today,
  dayWeight,
  lastWeight,
  profileWeight,
  goal,
  imperial,
  onSaved,
}: {
  date: string;
  today: string;
  /** Weight logged on the viewed day, if any. */
  dayWeight?: number;
  /** Most recent weigh-in on or before the viewed day. */
  lastWeight: { weight_kg: number; date: string } | null;
  profileWeight?: number;
  goal: Goal | null;
  imperial: boolean;
  onSaved: (t: TrackingDay, user?: PublicUser) => void;
}) {
  const [input, setInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputId = React.useId();
  const hintId = React.useId();
  const unit = imperial ? "lb" : "kg";
  const isToday = date === today;

  const current = dayWeight ?? lastWeight?.weight_kg ?? profileWeight;
  const lastRel = lastWeight ? relativeDay(lastWeight.date, today) : "";
  const source =
    dayWeight != null
      ? isToday
        ? "Logged today"
        : "Logged this day"
      : lastWeight
        ? `Last logged ${lastRel === "Today" || lastRel === "Yesterday" ? lastRel.toLowerCase() : `on ${lastRel}`}`
        : profileWeight != null
          ? "From your profile"
          : "No weigh-ins yet";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(input.replace(",", "."));
    const kg = Number.isFinite(v) ? displayToKg(v, imperial) : NaN;
    if (!input.trim() || !Number.isFinite(kg) || kg < MIN_KG || kg > MAX_KG) {
      const lo = kgToDisplay(MIN_KG, imperial);
      const hi = kgToDisplay(MAX_KG, imperial);
      toast.error(`Enter a weight between ${Math.ceil(lo)} and ${Math.floor(hi)} ${unit}.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ tracking: TrackingDay; user?: PublicUser }>("/track/weight", { weight_kg: kg, date });
      onSaved(res.tracking, res.user);
      setInput("");
      toast.success(`Weight saved — ${kgToDisplay(res.tracking.weight_kg ?? kg, imperial)} ${unit}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Goal progress: from the goal's starting weight towards the target.
  let goalBlock: React.ReactNode = null;
  if (goal && current != null) {
    const start = goal.current_weight_kg;
    const target = goal.target_weight_kg;
    const toGo = Math.abs(current - target);
    const span = start - target;
    const progress = span === 0 ? 1 : clamp((start - current) / span, 0, 1);
    const reached = goal.goal === "maintain" ? toGo <= 1 : span > 0 ? current <= target : current >= target;
    goalBlock = (
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <span className="text-orza-strong">
            Goal {kgToDisplay(target, imperial)} {unit}
          </span>
          <span className="tabular-nums text-orza-muted">
            {goal.goal === "maintain"
              ? reached
                ? "Holding steady"
                : `${kgToDisplay(toGo, imperial)} ${unit} away`
              : reached
                ? "Goal reached"
                : `${kgToDisplay(toGo, imperial)} ${unit} to go`}
          </span>
        </div>
        {goal.goal !== "maintain" && <Bar value={progress} max={1} tone="violet" />}
      </div>
    );
  }

  return (
    <GlassCard className="flex h-full flex-col">
      <TrackerHead
        icon={<Scale size={17} strokeWidth={1.75} aria-hidden />}
        tone="violet"
        label="Weight"
        right={
          <Link href="/dashboard/goals" className="inline-flex items-center gap-0.5 text-orza-muted hover:text-orza-strong">
            {goal ? "Goal" : "Set a goal"} <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
          </Link>
        }
      />

      <BigNumber className="mt-4" value={current != null ? kgToDisplay(current, imperial) : "—"} caption={unit} />
      <p className="mt-2 text-xs text-orza-subtle">{source}</p>
      {goalBlock}

      <form onSubmit={submit} className="mt-auto pt-5" noValidate>
        <label htmlFor={inputId} className="sr-only">
          Weight in {imperial ? "pounds" : "kilograms"} {isToday ? "today" : "for this day"}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            type="number"
            inputMode="decimal"
            step={0.1}
            min={kgToDisplay(MIN_KG, imperial)}
            max={kgToDisplay(MAX_KG, imperial)}
            placeholder={current != null ? String(kgToDisplay(current, imperial)) : imperial ? "e.g. 154" : "e.g. 70.5"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-describedby={hintId}
            className="h-10"
          />
          <Button type="submit" variant="secondary" loading={saving} disabled={!input.trim()} className="shrink-0">
            Save
          </Button>
        </div>
        <FieldHint id={hintId}>Weigh in at the same time of day for a steadier trend.</FieldHint>
      </form>
    </GlassCard>
  );
}
