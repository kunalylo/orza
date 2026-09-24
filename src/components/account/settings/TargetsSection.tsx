"use client";
import * as React from "react";
import { Info, RotateCcw, Target } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { TARGET_FIELDS, type TargetKey } from "@/components/account/options";
import { FieldError, SectionCard } from "@/components/account/ui";
import type { ProfileResponse, UserResponse } from "@/components/account/types";
import { api, errorMessage } from "@/lib/api-client";
import { DEFAULT_TARGETS } from "@/lib/domain/targets";
import type { Targets } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

type Draft = Record<TargetKey, string>;

const toDraft = (t: Targets | undefined): Draft =>
  Object.fromEntries(TARGET_FIELDS.map((f) => [f.key, String(t?.[f.key] ?? DEFAULT_TARGETS[f.key])])) as Draft;

const same = (a: Draft, b: Draft) => TARGET_FIELDS.every((f) => a[f.key] === b[f.key]);

/** Daily targets — hand-tune the numbers, or reset them to what ÖRZA recommends for your profile and goal. */
export function TargetsSection() {
  const { user, setUser } = useUser();
  const baseline = React.useMemo(() => toDraft(user.targets), [user.targets]);
  const [draft, setDraft] = React.useState<Draft>(baseline);
  const [errors, setErrors] = React.useState<Partial<Record<TargetKey, string>>>({});
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const baselineRef = React.useRef(baseline);
  React.useEffect(() => {
    setDraft((d) => (same(d, baselineRef.current) ? baseline : d));
    baselineRef.current = baseline;
  }, [baseline]);

  const dirty = !same(draft, baseline);

  // Energy implied by the macros (4/4/9 kcal per gram) vs the calorie target.
  const num = (k: TargetKey) => Number(draft[k]) || 0;
  const macroKcal = num("protein_g") * 4 + num("carbs_g") * 4 + num("fat_g") * 9;
  const calories = num("calories");
  const gap = calories > 0 ? (macroKcal - calories) / calories : 0;
  const mismatch = calories > 0 && macroKcal > 0 && Math.abs(gap) > 0.12;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<TargetKey, string>> = {};
    const body: Partial<Targets> = {};
    for (const f of TARGET_FIELDS) {
      if (draft[f.key] === baseline[f.key]) continue;
      const n = Number(draft[f.key]);
      if (!draft[f.key].trim() || !Number.isFinite(n)) errs[f.key] = `Enter a number`;
      else if (!Number.isInteger(n)) errs[f.key] = "Use a whole number";
      else if (n < f.min || n > f.max) errs[f.key] = `Between ${formatNumber(f.min)} and ${formatNumber(f.max)}`;
      else body[f.key] = n;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (!Object.keys(body).length) return;
    setSaving(true);
    try {
      const res = await api.put<UserResponse>("/settings/targets", body);
      setUser(res.user);
      setDraft(toDraft(res.user.targets));
      toast.success("Daily targets saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setResetting(true);
    try {
      const res = await api.put<ProfileResponse>("/profile", { recompute_targets: true });
      setUser(res.user);
      setDraft(toDraft(res.user.targets));
      setErrors({});
      toast.success("Targets reset", { description: "Back to ÖRZA's recommendation for your profile and goal." });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <SectionCard
      id="targets"
      icon={<Target size={18} strokeWidth={1.75} aria-hidden />}
      tone="cyan"
      eyebrow="Daily targets"
      title="Your daily numbers"
      description="These drive your Today ring, reports and suggestions. Fine-tune them, or reset to what ÖRZA recommends."
      actions={
        <Button variant="secondary" size="sm" onClick={reset} loading={resetting} disabled={saving}>
          {!resetting && <RotateCcw size={14} strokeWidth={1.75} aria-hidden />}
          Reset to recommended
        </Button>
      }
    >
      <form onSubmit={save} noValidate>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TARGET_FIELDS.map((f) => {
            const id = `tg-${f.key}`;
            const err = errors[f.key];
            const changed = draft[f.key] !== baseline[f.key];
            return (
              <div
                key={f.key}
                className={cn(
                  "rounded-orza-sm border bg-white/60 p-3.5 transition-[border-color,box-shadow,background-color] duration-150 ease-orza",
                  "focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(11,190,220,0.18)]",
                  err ? "border-[rgba(176,44,44,0.35)]" : changed ? "border-[rgba(11,190,220,0.40)]" : "border-[rgba(20,20,20,0.08)]",
                  f.key === "calories" && "col-span-2 sm:col-span-1"
                )}
              >
                <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">
                  {f.label}
                </label>
                <div className="relative mt-1.5">
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={draft[f.key]}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^\d]/g, "").slice(0, 6);
                      setDraft((d) => ({ ...d, [f.key]: v }));
                      if (err) setErrors((x) => ({ ...x, [f.key]: undefined }));
                    }}
                    aria-invalid={!!err}
                    aria-describedby={err ? `${id}-error` : undefined}
                    className="h-11 border-transparent bg-transparent px-0 pr-16 font-editorial text-[24px] font-semibold tabular-nums text-orza-strong focus:border-transparent focus:bg-transparent focus:shadow-none"
                  />
                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[12px] text-orza-subtle">{f.unit}</span>
                </div>
                <FieldError id={`${id}-error`}>{err}</FieldError>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-orza-muted">
          <Info size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-orza-subtle" aria-hidden />
          <p>
            Your protein, carbs and fat add up to about <span className="font-medium tabular-nums text-orza-strong">{formatNumber(macroKcal)} kcal</span>
            {mismatch && (
              <>
                {" "}
                <Tag tone="warning" size="sm" className="ml-1 align-middle">
                  {gap > 0 ? "above" : "below"} your calorie target
                </Tag>
              </>
            )}
            {!mismatch && calories > 0 && " — in step with your calorie target."}
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[rgba(20,20,20,0.08)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-orza-subtle">Targets are gentle guides, not rules. Changing your profile or goal may update them.</p>
          <div className="flex gap-2">
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(baseline);
                  setErrors({});
                }}
                disabled={saving}
              >
                Discard
              </Button>
            )}
            <Button type="submit" variant="primary" loading={saving} disabled={!dirty || resetting}>
              Save targets
            </Button>
          </div>
        </div>
      </form>
    </SectionCard>
  );
}
