"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Plus, RotateCcw, Sparkles, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Segmented, Select } from "@/components/ui/form";
import {
  ACTIVITY_OPTIONS,
  ALLERGY_SUGGESTIONS,
  DIET_OPTIONS,
  GOAL_LABELS,
  HOUSEHOLD_OPTIONS,
  LANGUAGE_OPTIONS,
  LIFESTYLE_SUGGESTIONS,
  PROFILE_LIMITS as L,
} from "@/components/account/options";
import { FieldError, SectionCard } from "@/components/account/ui";
import type { ProfileResponse } from "@/components/account/types";
import { buildPatch, sameDraft, toDraft, type DraftErrors, type ProfileDraft } from "@/components/account/settings/profile-draft";
import { api, errorMessage } from "@/lib/api-client";
import { INDIAN_REGIONS, OUTSIDE_INDIA } from "@/lib/onboarding";
import type { Sex, Targets } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

const chip =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-150 ease-orza";
const chipOff = "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-muted hover:bg-white hover:text-orza-strong";
const chipOn = "border-transparent bg-[#141414] text-orza-bg-0";

/** Field wrapper: label + control + hint/error. */
function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldHint id={`${id}-hint`}>{hint}</FieldHint> : null}
    </div>
  );
}

/** Group label for button-group controls (Segmented / chips) — not a <label>, since there's no single input. */
function GroupField({ id, label, error, className, children }: { id: string; label: React.ReactNode; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className} role="group" aria-labelledby={`${id}-label`}>
      <div id={`${id}-label`} className="mb-1.5 block text-[13px] font-medium text-orza-strong">
        {label}
      </div>
      {children}
      <FieldError>{error}</FieldError>
    </div>
  );
}

const describedBy = (id: string, error?: string) => (error ? `${id}-error` : undefined);

function TargetsCallout({ targets, onDismiss }: { targets: Targets; onDismiss: () => void }) {
  const items = [
    { label: "Calories", value: `${formatNumber(targets.calories)} kcal` },
    { label: "Protein", value: `${targets.protein_g} g` },
    { label: "Carbs", value: `${targets.carbs_g} g` },
    { label: "Fat", value: `${targets.fat_g} g` },
    { label: "Water", value: `${targets.water_glasses} glasses` },
    { label: "Steps", value: formatNumber(targets.steps) },
  ];
  return (
    <div role="status" className="relative mt-6 overflow-hidden rounded-orza-sm border border-[rgba(255,122,106,0.28)] bg-[#FFF1EA]/80 p-4 pr-12">
      <div className="flex items-center gap-2 text-[14px] font-medium text-orza-strong">
        <Sparkles size={15} strokeWidth={1.75} className="text-[#E0593F]" aria-hidden />
        Your daily targets were updated
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((i) => (
          <div key={i.label}>
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{i.label}</dt>
            <dd className="text-[14px] font-medium tabular-nums text-orza-strong">{i.value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-orza-muted hover:bg-white/70 hover:text-orza-strong"
      >
        <X size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** Profile — body, food and household details that personalise targets and advice. */
export function ProfileSection() {
  const { user, setUser } = useUser();
  const units = user.preferences?.units === "imperial" ? "imperial" : "metric";
  const baseline = React.useMemo(() => toDraft(user, units), [user, units]);

  const [draft, setDraft] = React.useState<ProfileDraft>(baseline);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [updatedTargets, setUpdatedTargets] = React.useState<Targets | null>(null);
  const [allergyInput, setAllergyInput] = React.useState("");

  // Follow outside changes (e.g. a units switch) unless the user has unsaved edits.
  const baselineRef = React.useRef(baseline);
  React.useEffect(() => {
    setDraft((d) => (sameDraft(d, baselineRef.current) ? baseline : d));
    baselineRef.current = baseline;
  }, [baseline]);

  const draftBase = React.useMemo(() => (draft.units === baseline.units ? baseline : toDraft(user, draft.units)), [draft.units, baseline, user]);
  const dirty = !sameDraft(draft, draftBase);
  const imperial = draft.units === "imperial";

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    const errKey = key === "height_cm" || key === "height_ft" || key === "height_in" ? "height" : key;
    setErrors((e) => (e[errKey as keyof DraftErrors] ? { ...e, [errKey]: undefined } : e));
  };

  const toggleAllergy = (value: string) => {
    const v = value.trim().toLowerCase();
    set("allergies", draft.allergies.includes(v) ? draft.allergies.filter((a) => a !== v) : [...draft.allergies, v]);
  };

  const addAllergy = () => {
    const v = allergyInput.trim().replace(/\s+/g, " ").toLowerCase();
    if (!v) return;
    if (v.length > L.allergies.maxLength) {
      setErrors((e) => ({ ...e, allergies: `Keep each one under ${L.allergies.maxLength} characters` }));
      return;
    }
    if (draft.allergies.length >= L.allergies.maxItems) {
      setErrors((e) => ({ ...e, allergies: `You can save up to ${L.allergies.maxItems}` }));
      return;
    }
    if (!draft.allergies.includes(v)) set("allergies", [...draft.allergies, v]);
    setAllergyInput("");
  };

  const addLifestyle = (s: string) => {
    const cur = draft.lifestyle.trim();
    if (cur.toLowerCase().includes(s.toLowerCase())) return;
    const next = cur ? `${cur}, ${s}` : s;
    if (next.length <= L.lifestyle.maxLength) set("lifestyle", next);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { patch, errors: errs, changed } = buildPatch(draft, draftBase);
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      toast.error("Please check the highlighted fields");
      return;
    }
    if (!changed) return;
    setSaving(true);
    try {
      const res = await api.put<ProfileResponse>("/profile", patch);
      setUser(res.user);
      setDraft(toDraft(res.user, units));
      setErrors({});
      if (res.targets_recomputed) {
        setUpdatedTargets(res.user.targets);
        toast.success("Profile saved", { description: "Your daily targets were recalculated." });
      } else {
        toast.success("Profile saved");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const customAllergies = draft.allergies.filter((a) => !ALLERGY_SUGGESTIONS.some((s) => s.value === a));
  const goal = user.profile?.goal;

  return (
    <SectionCard
      id="profile"
      icon={<UserRound size={18} strokeWidth={1.75} aria-hidden />}
      tone="energy"
      eyebrow="Profile"
      title="About you"
      description="ÖRZA uses these details to set your daily targets and to suggest food that fits your diet, region and routine."
    >
      {goal && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 px-4 py-3">
          <div className="text-[14px] text-orza-strong">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Current goal</span>
            <div className="mt-0.5 font-medium">
              {GOAL_LABELS[goal]}
              {goal !== "maintain" && user.profile?.target_weight_kg != null && (
                <span className="font-normal text-orza-muted">
                  {" "}
                  · target{" "}
                  {imperial ? `${Math.round(user.profile.target_weight_kg * 2.20462)} lb` : `${user.profile.target_weight_kg} kg`}
                </span>
              )}
            </div>
          </div>
          <Link href="/dashboard/goals" className="inline-flex items-center gap-1 text-[13px] font-medium text-orza-strong underline-offset-4 hover:underline">
            Change goal <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      )}

      <form onSubmit={save} noValidate>
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="pf-name" label="Name" error={errors.name}>
            <Input
              id="pf-name"
              value={draft.name}
              maxLength={L.name.maxLength}
              autoComplete="name"
              onChange={(e) => set("name", e.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={describedBy("pf-name", errors.name)}
            />
          </Field>
          <Field id="pf-email" label="Email" hint="Used to sign in. It can't be changed here." className="lg:col-span-2">
            <Input id="pf-email" value={user.email} readOnly aria-readonly className="bg-white/50 text-orza-muted" aria-describedby="pf-email-hint" />
          </Field>

          <Field id="pf-age" label="Age" error={errors.age}>
            <Input
              id="pf-age"
              inputMode="numeric"
              value={draft.age}
              onChange={(e) => set("age", e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
              placeholder="e.g. 32"
              aria-invalid={!!errors.age}
              aria-describedby={describedBy("pf-age", errors.age)}
            />
          </Field>
          <GroupField id="pf-sex" label="Sex" error={errors.sex}>
            <Segmented<Sex | ""> aria-labelledby="pf-sex-label"
              value={draft.sex}
              onChange={(v) => set("sex", v)}
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "other", label: "Other" },
              ]}
              className="w-full [&>button]:flex-1"
            />
          </GroupField>

          {imperial ? (
            <div role="group" aria-labelledby="pf-height-label">
              <div id="pf-height-label" className="mb-1.5 block text-[13px] font-medium text-orza-strong">
                Height
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    aria-label="Height, feet"
                    inputMode="numeric"
                    value={draft.height_ft}
                    onChange={(e) => set("height_ft", e.target.value.replace(/[^\d]/g, "").slice(0, 1))}
                    className="pr-9"
                    aria-invalid={!!errors.height}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-orza-subtle">ft</span>
                </div>
                <div className="relative flex-1">
                  <Input
                    aria-label="Height, inches"
                    inputMode="decimal"
                    value={draft.height_in}
                    onChange={(e) => set("height_in", e.target.value.replace(/[^\d.]/g, "").slice(0, 4))}
                    className="pr-9"
                    aria-invalid={!!errors.height}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-orza-subtle">in</span>
                </div>
              </div>
              <FieldError>{errors.height}</FieldError>
            </div>
          ) : (
            <Field id="pf-height" label="Height" error={errors.height}>
              <div className="relative">
                <Input
                  id="pf-height"
                  inputMode="decimal"
                  value={draft.height_cm}
                  onChange={(e) => set("height_cm", e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
                  placeholder="e.g. 165"
                  className="pr-11"
                  aria-invalid={!!errors.height}
                  aria-describedby={describedBy("pf-height", errors.height)}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-orza-subtle">cm</span>
              </div>
            </Field>
          )}

          <Field id="pf-weight" label="Weight" error={errors.weight} hint="Changing it also logs today's weigh-in.">
            <div className="relative">
              <Input
                id="pf-weight"
                inputMode="decimal"
                value={draft.weight}
                onChange={(e) => set("weight", e.target.value.replace(/[^\d.]/g, "").slice(0, 6))}
                placeholder={imperial ? "e.g. 150" : "e.g. 68"}
                className="pr-11"
                aria-invalid={!!errors.weight}
                aria-describedby={errors.weight ? "pf-weight-error" : "pf-weight-hint"}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-orza-subtle">{imperial ? "lb" : "kg"}</span>
            </div>
          </Field>
          <Field
            id="pf-activity"
            label="Activity"
            hint={ACTIVITY_OPTIONS.find((o) => o.value === draft.activity_level)?.hint}
          >
            <Select
              id="pf-activity"
              value={draft.activity_level}
              onChange={(e) => set("activity_level", e.target.value as ProfileDraft["activity_level"])}
              aria-describedby={draft.activity_level ? "pf-activity-hint" : undefined}
            >
              {!draft.activity_level && <option value="">Choose…</option>}
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="pf-diet" label="Diet">
            <Select id="pf-diet" value={draft.diet} onChange={(e) => set("diet", e.target.value as ProfileDraft["diet"])}>
              {!draft.diet && <option value="">Choose…</option>}
              {DIET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="pf-region" label="Region" error={errors.region} hint="Your state helps ÖRZA suggest familiar dishes.">
            <Input
              id="pf-region"
              list="pf-region-list"
              value={draft.region}
              maxLength={L.region.maxLength}
              onChange={(e) => set("region", e.target.value)}
              placeholder="e.g. Maharashtra"
              autoComplete="off"
              aria-invalid={!!errors.region}
              aria-describedby={errors.region ? "pf-region-error" : "pf-region-hint"}
            />
            <datalist id="pf-region-list">
              {[...INDIAN_REGIONS, OUTSIDE_INDIA].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <GroupField id="pf-language" label="Language">
            <Segmented<ProfileDraft["language"]> aria-labelledby="pf-language-label"
              value={draft.language}
              onChange={(v) => set("language", v)}
              options={LANGUAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label.split(" (")[0] }))}
              className="w-full [&>button]:flex-1 [&>button]:px-2"
            />
          </GroupField>
          <Field id="pf-household" label="Household" hint={HOUSEHOLD_OPTIONS.find((o) => o.value === draft.household_mode)?.hint}>
            <Select
              id="pf-household"
              value={draft.household_mode}
              onChange={(e) => set("household_mode", e.target.value as ProfileDraft["household_mode"])}
              aria-describedby={draft.household_mode ? "pf-household-hint" : undefined}
            >
              {!draft.household_mode && <option value="">Choose…</option>}
              {HOUSEHOLD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <GroupField id="pf-allergies" label="Allergies & foods you avoid" error={errors.allergies} className="sm:col-span-2 lg:col-span-3">
            <div className="flex flex-wrap gap-2">
              {ALLERGY_SUGGESTIONS.map((o) => {
                const on = draft.allergies.includes(o.value);
                return (
                  <button key={o.value} type="button" aria-pressed={on} onClick={() => toggleAllergy(o.value)} className={cn(chip, on ? chipOn : chipOff)}>
                    {on && <Check size={13} strokeWidth={2} aria-hidden />}
                    {o.label}
                  </button>
                );
              })}
              {customAllergies.map((a) => (
                <span key={a} className={cn(chip, chipOn, "pr-1.5")}>
                  <span className="capitalize">{a}</span>
                  <button
                    type="button"
                    onClick={() => toggleAllergy(a)}
                    aria-label={`Remove ${a}`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/15"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex max-w-md gap-2">
              <Input
                aria-label="Add another allergy or food you avoid"
                value={allergyInput}
                maxLength={L.allergies.maxLength}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAllergy();
                  }
                }}
                placeholder="Add another, e.g. mushrooms"
                className="h-10"
              />
              <Button type="button" variant="secondary" onClick={addAllergy} disabled={!allergyInput.trim()} aria-label="Add allergy">
                <Plus size={15} strokeWidth={1.75} aria-hidden /> Add
              </Button>
            </div>
            {!draft.allergies.length && <FieldHint>No allergies saved — ÖRZA will suggest anything that fits your diet.</FieldHint>}
          </GroupField>

          <Field id="pf-lifestyle" label="Routine (optional)" error={errors.lifestyle} className="sm:col-span-2 lg:col-span-3">
            <Input
              id="pf-lifestyle"
              value={draft.lifestyle}
              maxLength={L.lifestyle.maxLength}
              onChange={(e) => set("lifestyle", e.target.value)}
              placeholder="e.g. Desk job, gym three evenings a week"
              aria-invalid={!!errors.lifestyle}
              aria-describedby={describedBy("pf-lifestyle", errors.lifestyle)}
            />
            <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Routine suggestions">
              {LIFESTYLE_SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => addLifestyle(s)} className={cn(chip, chipOff, "py-1 text-[12px]")}>
                  <Plus size={12} strokeWidth={2} aria-hidden /> {s}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[rgba(20,20,20,0.08)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-orza-subtle" aria-live="polite">
            {dirty ? "You have unsaved changes." : "Changing age, sex, height, weight or activity recalculates your daily targets."}
          </p>
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
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden /> Discard
              </Button>
            )}
            <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
              Save profile
            </Button>
          </div>
        </div>
      </form>

      {updatedTargets && <TargetsCallout targets={updatedTargets} onDismiss={() => setUpdatedTargets(null)} />}
    </SectionCard>
  );
}
