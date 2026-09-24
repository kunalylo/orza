"use client";
import * as React from "react";
import { Cake, Gem, PartyPopper, PenLine, Plane, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Segmented, Textarea } from "@/components/ui/form";
import type { RebalanceCreateResponse } from "@/components/goals/types";

const OCCASIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "Wedding", label: "Wedding", icon: Gem },
  { value: "Birthday", label: "Birthday", icon: Cake },
  { value: "Festival", label: "Festival", icon: Sparkles },
  { value: "Party", label: "Party", icon: PartyPopper },
  { value: "Vacation", label: "Vacation", icon: Plane },
  { value: "Other", label: "Other", icon: PenLine },
];

const PLACEHOLDERS: Record<string, string> = {
  Wedding: "e.g. Wedding buffet — paneer tikka, biryani, 2 gulab jamun",
  Birthday: "e.g. 2 slices of chocolate cake, pizza and a cold drink",
  Festival: "e.g. Diwali sweets — 3 kaju katli, samosa and chole bhature",
  Party: "e.g. Fries, nachos, 2 slices of pizza and a mocktail",
  Vacation: "e.g. Big hotel breakfast buffet and a seafood dinner",
  Other: "e.g. Dinner out — butter chicken, 2 butter naan and dessert",
};

type Days = "2" | "3" | "4" | "5";

/** Occasion chips, "what did you eat?", optional calories and a 2–5 day spread → POST /api/compensation/plan. */
export function RebalanceForm({
  aiEnabled,
  cost,
  onCreated,
}: {
  aiEnabled?: boolean;
  cost?: number;
  onCreated: (res: RebalanceCreateResponse) => void;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [occasion, setOccasion] = React.useState<string | null>(null);
  const [custom, setCustom] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [days, setDays] = React.useState<Days>("3");
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<{ occasion?: string; calories?: string }>({});
  const customRef = React.useRef<HTMLInputElement>(null);

  const pick = (value: string) => {
    setOccasion(value);
    setErrors((e) => ({ ...e, occasion: undefined }));
    if (value === "Other") requestAnimationFrame(() => customRef.current?.focus());
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const occ = occasion === "Other" ? custom.trim() : occasion;
    const next: typeof errors = {};
    if (!occ) next.occasion = occasion === "Other" ? "Tell ÖRZA what the occasion was." : "Pick the occasion you're rebalancing for.";
    else if (occ.length < 2) next.occasion = "Use at least 2 characters.";
    const kcal = calories.trim() ? Number(calories) : null;
    if (kcal != null && (!Number.isFinite(kcal) || kcal < 100 || kcal > 5000)) next.calories = "Enter between 100 and 5,000 kcal — or leave it blank.";
    setErrors(next);
    if (next.occasion || next.calories) return;

    setLoading(true);
    try {
      const res = await api.post<RebalanceCreateResponse>("/compensation/plan", {
        occasion: occ,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(kcal != null ? { extra_calories: Math.round(kcal) } : {}),
        days: Number(days),
      });
      onCreated(res);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Create a rebalance plan">
      <GlassCard variant="strong" className="sm:p-7">
        <fieldset>
          <legend className="text-[13px] font-medium text-orza-strong">What was the occasion?</legend>
          <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Occasion" aria-describedby={errors.occasion ? `${uid}-occ-err` : undefined}>
            {OCCASIONS.map(({ value, label, icon: Icon }) => {
              const selected = occasion === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pick(value)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-orza",
                    "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(11,190,220,0.25)]",
                    selected
                      ? "border-[#141414] bg-[#141414] text-orza-bg-0 shadow-[0_8px_20px_rgba(20,20,20,0.16)]"
                      : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-muted hover:bg-white hover:text-orza-strong"
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} aria-hidden className={cn(selected ? "text-[#FFB454]" : "text-orza-subtle")} />
                  {label}
                </button>
              );
            })}
          </div>
          {occasion === "Other" && (
            <div className="mt-3">
              <Label htmlFor={`${uid}-custom`} className="sr-only">
                Occasion
              </Label>
              <Input
                ref={customRef}
                id={`${uid}-custom`}
                maxLength={80}
                placeholder="e.g. Office farewell, Anniversary dinner"
                value={custom}
                onChange={(e) => {
                  setCustom(e.target.value);
                  if (errors.occasion) setErrors((x) => ({ ...x, occasion: undefined }));
                }}
              />
            </div>
          )}
          {errors.occasion && (
            <FieldHint id={`${uid}-occ-err`} role="alert" className="text-[#B02C2C]">
              {errors.occasion}
            </FieldHint>
          )}
        </fieldset>

        <div className="mt-6">
          <Label htmlFor={`${uid}-desc`}>What did you eat?</Label>
          <Textarea
            id={`${uid}-desc`}
            maxLength={500}
            rows={3}
            placeholder={PLACEHOLDERS[occasion || "Wedding"]}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-describedby={`${uid}-desc-hint`}
          />
          <FieldHint id={`${uid}-desc-hint`} className="flex justify-between gap-3">
            <span>Optional — English, Hindi or Hinglish all work.</span>
            <span className="tabular-nums">{description.length}/500</span>
          </FieldHint>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${uid}-kcal`}>Extra calories (optional)</Label>
            <div className="relative">
              <Input
                id={`${uid}-kcal`}
                type="number"
                inputMode="numeric"
                min={100}
                max={5000}
                step={10}
                placeholder="e.g. 800"
                value={calories}
                onChange={(e) => {
                  setCalories(e.target.value);
                  if (errors.calories) setErrors((x) => ({ ...x, calories: undefined }));
                }}
                aria-invalid={!!errors.calories}
                aria-describedby={`${uid}-kcal-hint`}
                className="pr-14"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-orza-subtle" aria-hidden>
                kcal
              </span>
            </div>
            <FieldHint id={`${uid}-kcal-hint`} className={errors.calories ? "text-[#B02C2C]" : undefined}>
              {errors.calories || "Not sure? Leave it blank — ÖRZA will estimate from what you ate."}
            </FieldHint>
          </div>
          <div>
            <span id={`${uid}-days`} className="mb-1.5 block text-[13px] font-medium text-orza-strong">
              Days to spread it over
            </span>
            <div role="group" aria-labelledby={`${uid}-days`}>
              <Segmented<Days>
                className="grid w-full grid-cols-4"
                value={days}
                onChange={setDays}
                options={(["2", "3", "4", "5"] as Days[]).map((d) => ({ value: d, label: d }))}
              />
            </div>
            <FieldHint>Starting tomorrow. More days means gentler changes.</FieldHint>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 border-t border-[rgba(20,20,20,0.08)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-orza-subtle">
            {aiEnabled
              ? `Personalised by ÖRZA's AI for ${cost ?? 1} credit${(cost ?? 1) === 1 ? "" : "s"} — the built-in plan is always there if credits run out.`
              : aiEnabled === false
              ? "Free built-in plan, tailored to your targets and diet."
              : "Tailored to your usual targets and diet."}
          </p>
          <Button type="submit" variant="energy" size="lg" loading={loading} className="w-full shrink-0 sm:w-auto">
            {!loading && <Sparkles size={15} strokeWidth={1.75} aria-hidden />}
            {loading ? "Creating your plan…" : "Create my plan"}
          </Button>
        </div>
      </GlassCard>
    </form>
  );
}
