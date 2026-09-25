"use client";
import * as React from "react";
import { toast } from "sonner";
import { Scale } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import type { PublicUser, TrackingDay } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/form";
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG, kgToUnit, unitToKg, weightRange, weightUnit } from "@/components/goals/goal-math";

/**
 * Inline "log today's weight" — posts to /api/track/weight, which also keeps
 * profile.weight_kg current (the updated public user comes back when it changed).
 * The number is typed in the user's unit (kg or lb) and always sent as kg.
 */
export function LogWeightForm({
  placeholderKg,
  imperial = false,
  onLogged,
}: {
  /** Latest weigh-in (kg), shown as the placeholder in the user's unit. */
  placeholderKg?: number | null;
  imperial?: boolean;
  onLogged: (weightKg: number, tracking?: TrackingDay, user?: PublicUser) => void;
}) {
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const hintId = React.useId();
  const unit = weightUnit(imperial);
  const range = weightRange(imperial);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(value);
    const kg = value && Number.isFinite(w) ? unitToKg(w, imperial) : NaN;
    if (!(kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG)) {
      setError(`Enter a weight between ${range.min} and ${range.max} ${unit}.`);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await api.post<{ tracking: TrackingDay; user?: PublicUser }>("/track/weight", { weight_kg: kg });
      toast.success("Weight logged — thanks for checking in.");
      setValue("");
      onLogged(res?.tracking?.weight_kg ?? kg, res?.tracking, res?.user);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Label htmlFor={id}>Today&apos;s weight</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={range.min}
            max={range.max}
            placeholder={placeholderKg ? String(kgToUnit(placeholderKg, imperial)) : imperial ? "e.g. 160" : "e.g. 72.5"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={hintId}
            className="pr-11"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-orza-subtle" aria-hidden>
            {unit}
          </span>
        </div>
        <Button type="submit" loading={saving} disabled={!value} className="h-11 shrink-0">
          {!saving && <Scale size={15} strokeWidth={1.75} aria-hidden />} Log
        </Button>
      </div>
      <FieldHint id={hintId} className={error ? "text-[#B02C2C]" : undefined} role={error ? "alert" : undefined}>
        {error || "Same time of day, once or twice a week, gives the clearest trend."}
      </FieldHint>
    </form>
  );
}
