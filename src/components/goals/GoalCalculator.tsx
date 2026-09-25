"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CircleAlert, Info, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import type { ActivityLevel, Goal, GoalType, Profile, Sex, Targets } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { Eyebrow, GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Segmented, Select } from "@/components/ui/form";
import { OrbPanel } from "@/components/goals/OrbPanel";
import {
  GAIN_PACES,
  KG_PER_LB,
  LOSS_PACES,
  MAX_HEIGHT_CM,
  MAX_WEIGHT_KG,
  MIN_HEIGHT_CM,
  MIN_WEIGHT_KG,
  cmToFeetInches,
  feetInchesToCm,
  formatLongDate,
  formatPace,
  goalInputError,
  healthyFloorKg,
  kgToUnit,
  planGoal,
  signedRate,
  unitToKg,
  weightRange,
  weightUnit,
} from "@/components/goals/goal-math";
import type { GoalCalculateResponse } from "@/components/goals/types";

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: "sedentary", label: "Sedentary", hint: "Mostly sitting — desk work, little exercise" },
  { value: "light", label: "Lightly active", hint: "Daily walks, light chores, exercise 1–2 days" },
  { value: "moderate", label: "Moderately active", hint: "Exercise 3–5 days a week" },
  { value: "active", label: "Active", hint: "Exercise most days of the week" },
  { value: "very_active", label: "Very active", hint: "Physical work or hard training daily" },
];

const PACE_NOTES: Record<number, string> = {
  0.25: "Easiest to sustain",
  0.5: "A balanced pace",
  0.75: "Needs more focus",
};

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const valid = (n: number, lo: number, hi: number) => Number.isFinite(n) && n >= lo && n <= hi;

/** Closest offered pace to a stored weekly rate. */
function nearestPace(goal: GoalType, rate?: number | null): number {
  const options = goal === "gain" ? GAIN_PACES.map((p) => p.rate) : LOSS_PACES.map((p) => p.rate);
  const r = Math.abs(Number(rate) || 0);
  if (!r) return goal === "gain" ? 0.25 : 0.5;
  return options.reduce((best, o) => (Math.abs(o - r) < Math.abs(best - r) ? o : best), options[0]);
}

function Field({ id, label, unit, hint, error, ...rest }: { id: string; label: string; unit?: string; hint?: React.ReactNode; error?: string | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = `${id}-hint`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} aria-invalid={!!error} aria-describedby={hint || error ? hintId : undefined} className={cn(unit && "pr-12")} {...rest} />
        {unit && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-orza-subtle" aria-hidden>
            {unit}
          </span>
        )}
      </div>
      {(error || hint) && (
        <FieldHint id={hintId} className={error ? "text-[#B02C2C]" : undefined}>
          {error || hint}
        </FieldHint>
      )}
    </div>
  );
}

/** Height typed as feet + inches (imperial units). */
function FeetInchesField({
  id,
  ft,
  inches,
  onFt,
  onInches,
  error,
}: {
  id: string;
  ft: string;
  inches: string;
  onFt: (v: string) => void;
  onInches: (v: string) => void;
  error?: string | null;
}) {
  const hintId = `${id}-hint`;
  const described = error ? hintId : undefined;
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-orza-strong">Height</legend>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <Input
            id={`${id}-ft`}
            aria-label="Height, feet"
            type="number"
            inputMode="numeric"
            min={3}
            max={8}
            step={1}
            placeholder="5"
            value={ft}
            onChange={(e) => onFt(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={described}
            className="pr-8"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-orza-subtle" aria-hidden>
            ft
          </span>
        </div>
        <div className="relative">
          <Input
            id={`${id}-in`}
            aria-label="Height, inches"
            type="number"
            inputMode="decimal"
            min={0}
            max={11.5}
            step="0.5"
            placeholder="6"
            value={inches}
            onChange={(e) => onInches(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={described}
            className="pr-8"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-orza-subtle" aria-hidden>
            in
          </span>
        </div>
      </div>
      {error && (
        <FieldHint id={hintId} className="text-[#B02C2C]">
          {error}
        </FieldHint>
      )}
    </fieldset>
  );
}

/**
 * Goal planner: goal type, weights, a safe pace and the profile details that
 * drive BMR/TDEE — with a live calorie preview (pure `planGoal`, same maths as the server).
 * Weights and height are typed in the user's unit preference and always sent as kg / cm.
 */
export function GoalCalculator({
  goal: active,
  profile,
  latestWeight,
  currentTargets,
  today,
  imperial = false,
  onSaved,
}: {
  goal: Goal | null;
  profile: Profile;
  /** Latest weigh-in (kg). "Current weight" follows it whenever a new weigh-in is logged on the page. */
  latestWeight: number | null;
  currentTargets: Targets;
  today: string;
  /** Show and read weights in lb and height in ft/in (Settings → Units). */
  imperial?: boolean;
  onSaved: (res: GoalCalculateResponse) => void;
}) {
  const reduce = useReducedMotion();
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const initialGoal: GoalType = active?.goal || profile.goal || "lose";
  const [goal, setGoal] = React.useState<GoalType>(initialGoal);
  const unit = weightUnit(imperial);
  const range = weightRange(imperial);
  const [current, setCurrent] = React.useState(() => {
    const w = latestWeight ?? profile.weight_kg;
    return w ? String(kgToUnit(w, imperial)) : "";
  });
  const [target, setTarget] = React.useState(() => {
    const t = active && active.goal !== "maintain" ? active.target_weight_kg : profile.target_weight_kg;
    return t ? String(kgToUnit(t, imperial)) : "";
  });
  const [pace, setPace] = React.useState<number>(() => nearestPace(initialGoal, active?.weekly_rate_kg));
  const [height, setHeight] = React.useState(profile.height_cm ? String(profile.height_cm) : "");
  const [heightFt, setHeightFt] = React.useState(() => (profile.height_cm ? String(cmToFeetInches(profile.height_cm).ft) : ""));
  const [heightIn, setHeightIn] = React.useState(() => (profile.height_cm ? String(cmToFeetInches(profile.height_cm).inches) : ""));
  // Until ft/in are edited, keep the stored centimetres exactly (whole-inch rounding would drift them).
  const [heightEdited, setHeightEdited] = React.useState(false);
  const [age, setAge] = React.useState(profile.age ? String(profile.age) : "");
  const [sex, setSex] = React.useState<Sex | "">(profile.sex || "");
  const [activity, setActivity] = React.useState<ActivityLevel>(profile.activity_level || "light");
  const [saving, setSaving] = React.useState(false);

  // A weigh-in logged elsewhere on the page is the freshest number we have — follow it, so saving
  // the planner never writes an older "current weight" over today's weigh-in.
  const seenLatest = React.useRef(latestWeight);
  React.useEffect(() => {
    if (latestWeight == null || latestWeight === seenLatest.current) return;
    seenLatest.current = latestWeight;
    setCurrent(String(kgToUnit(latestWeight, imperial)));
  }, [latestWeight, imperial]);

  const changeGoal = (g: GoalType) => {
    setGoal(g);
    setPace((p) => (g === "gain" ? 0.25 : g === "lose" ? (LOSS_PACES.some((o) => o.rate === p) ? p : 0.5) : p));
  };

  /* ─── derived ─── */
  const curInput = num(current);
  const cur = Number.isFinite(curInput) ? unitToKg(curInput, imperial) : NaN;
  const tgtInput = num(target);
  const tgt = goal === "maintain" ? cur : Number.isFinite(tgtInput) ? unitToKg(tgtInput, imperial) : NaN;
  const ftN = num(heightFt);
  const inN = heightIn.trim() === "" ? 0 : num(heightIn);
  const h = !imperial
    ? num(height)
    : !heightEdited && profile.height_cm
      ? profile.height_cm
      : Number.isInteger(ftN) && ftN >= 0 && Number.isFinite(inN) && inN >= 0 && inN < 12
        ? feetInchesToCm(ftN, inN)
        : NaN;
  const a = num(age);
  const curOk = valid(cur, MIN_WEIGHT_KG, MAX_WEIGHT_KG);
  const tgtOk = valid(tgt, MIN_WEIGHT_KG, MAX_WEIGHT_KG);
  const hOk = valid(h, MIN_HEIGHT_CM, MAX_HEIGHT_CM);
  const heightTyped = imperial ? heightFt.trim() !== "" || heightIn.trim() !== "" : height.trim() !== "";
  const aOk = valid(a, 13, 100) && Number.isInteger(a);
  const rate = signedRate(goal, pace);

  const fieldErrors = {
    current: current && !curOk ? `Enter a weight between ${range.min} and ${range.max} ${unit}.` : null,
    target: goal !== "maintain" && target && !tgtOk ? `Enter a target between ${range.min} and ${range.max} ${unit}.` : null,
    height: heightTyped && !hOk ? (imperial ? "Enter a height between 3 ft 4 in and 8 ft 2 in." : "Height between 100 and 250 cm.") : null,
    age: age && !aOk ? "ÖRZA goal planning is for ages 13–100." : null,
  };

  const ready = curOk && tgtOk && hOk && aOk;
  const inputError = ready ? goalInputError({ goal, current: cur, target: tgt, rate, heightCm: h, imperial }) : null;

  const plan = React.useMemo(() => {
    if (!ready) return null;
    const merged: Profile = {
      ...profile,
      height_cm: h,
      age: a,
      ...(sex ? { sex } : {}),
      activity_level: activity,
      weight_kg: cur,
      goal,
    };
    return planGoal({ profile: merged, goal, current: cur, target: tgt, rate, today });
  }, [ready, profile, h, a, sex, activity, cur, goal, tgt, rate, today]);

  const blocker = inputError || plan?.blocker || null;
  const missing = [!curOk && "current weight", goal !== "maintain" && !tgtOk && "target weight", !hOk && "height", !aOk && "age"].filter(Boolean) as string[];
  const calDelta = plan ? plan.targets.calories - currentTargets.calories : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || blocker) {
      toast.error(blocker || `Add your ${missing.join(", ")} to see your plan.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<GoalCalculateResponse>("/goals/calculate", {
        goal,
        current_weight_kg: cur,
        target_weight_kg: tgt,
        weekly_rate_kg: rate,
        height_cm: Math.round(h * 10) / 10,
        age: a,
        ...(sex ? { sex } : {}),
        activity_level: activity,
      });
      onSaved(res);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const paces = goal === "gain" ? GAIN_PACES : LOSS_PACES;
  const floorKg = hOk ? healthyFloorKg(h) : null;

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
      {/* ─── inputs ─── */}
      <GlassCard variant="strong" className="sm:p-7">
        <fieldset>
          <legend className="text-[13px] font-medium text-orza-strong">What would you like to do?</legend>
          <Segmented<GoalType>
            className="mt-2 grid w-full grid-cols-3"
            value={goal}
            onChange={changeGoal}
            options={[
              { value: "lose", label: "Lose" },
              { value: "maintain", label: "Maintain" },
              { value: "gain", label: "Gain" },
            ]}
          />
        </fieldset>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            id={`${uid}-current`}
            label="Current weight"
            unit={unit}
            type="number"
            inputMode="decimal"
            step="0.1"
            min={range.min}
            max={range.max}
            placeholder={imperial ? "e.g. 160" : "e.g. 72.5"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            error={fieldErrors.current}
          />
          {goal === "maintain" ? (
            <div>
              <Label htmlFor={`${uid}-target`}>Target weight</Label>
              <Input id={`${uid}-target`} value={curOk ? `${kgToUnit(cur, imperial)} ${unit}` : "Same as current"} disabled readOnly aria-describedby={`${uid}-target-hint`} />
              <FieldHint id={`${uid}-target-hint`}>ÖRZA will help you hold steady around here.</FieldHint>
            </div>
          ) : (
            <Field
              id={`${uid}-target`}
              label="Target weight"
              unit={unit}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={range.min}
              max={range.max}
              placeholder={goal === "lose" ? (imperial ? "e.g. 145" : "e.g. 66") : imperial ? "e.g. 132" : "e.g. 60"}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              error={fieldErrors.target}
              hint={goal === "lose" && floorKg ? `The healthy range for your height starts around ${imperial ? `${Math.ceil(floorKg / KG_PER_LB)} lb` : `${floorKg} kg`}.` : undefined}
            />
          )}
        </div>

        {goal !== "maintain" && (
          <fieldset className="mt-6">
            <legend className="text-[13px] font-medium text-orza-strong">Pace</legend>
            <div role="group" aria-label="Weekly pace" className={cn("mt-2 grid gap-2", goal === "lose" ? "grid-cols-3" : "grid-cols-1")}>
              {paces.map((p) => {
                const selected = pace === p.rate;
                return (
                  <button
                    key={p.rate}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPace(p.rate)}
                    className={cn(
                      "relative rounded-orza-sm border px-3 py-3 text-left transition-[background-color,border-color,box-shadow] duration-150 ease-orza",
                      "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(11,190,220,0.25)]",
                      selected
                        ? "border-[rgba(255,122,106,0.45)] bg-[#FFF6F1] shadow-[0_8px_24px_rgba(255,122,106,0.12)]"
                        : "border-[rgba(20,20,20,0.10)] bg-white/60 hover:bg-white/90"
                    )}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-[14px] font-semibold text-orza-strong">{p.label}</span>
                      {selected && <Check size={14} strokeWidth={2} className="shrink-0 text-[#E0593F]" aria-hidden />}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] tracking-[0.02em] text-orza-muted">
                      {formatPace(p.rate, imperial)}/wk
                    </span>
                    <span className="mt-1 hidden text-[12px] leading-snug text-orza-subtle sm:block">
                      {goal === "gain" ? "Lean, steady gains — kind to your body" : PACE_NOTES[p.rate]}
                    </span>
                  </button>
                );
              })}
            </div>
            <FieldHint>
              {goal === "lose"
                ? `ÖRZA keeps weight loss at ${imperial ? "about 2.2 lb" : "1 kg"} a week or less, and never plans below a safe calorie floor.`
                : `ÖRZA keeps weight gain to ${imperial ? "about 1.1 lb" : "0.5 kg"} a week or less so it stays lean.`}
            </FieldHint>
          </fieldset>
        )}

        <div className="mt-7 border-t border-[rgba(20,20,20,0.08)] pt-6">
          <Eyebrow className="text-[11px]">About you</Eyebrow>
          <p className="mt-1 text-[13px] text-orza-muted">Used to estimate your energy needs. Prefilled from your profile — update anything that&apos;s changed.</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {imperial ? (
              <FeetInchesField
                id={`${uid}-height`}
                ft={heightFt}
                inches={heightIn}
                onFt={(v) => {
                  setHeightFt(v);
                  setHeightEdited(true);
                }}
                onInches={(v) => {
                  setHeightIn(v);
                  setHeightEdited(true);
                }}
                error={fieldErrors.height}
              />
            ) : (
              <Field
                id={`${uid}-height`}
                label="Height"
                unit="cm"
                type="number"
                inputMode="decimal"
                min={MIN_HEIGHT_CM}
                max={MAX_HEIGHT_CM}
                placeholder="e.g. 165"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                error={fieldErrors.height}
              />
            )}
            <Field
              id={`${uid}-age`}
              label="Age"
              unit="yrs"
              type="number"
              inputMode="numeric"
              min={13}
              max={100}
              step={1}
              placeholder="e.g. 30"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              error={fieldErrors.age}
            />
            <div>
              <Label htmlFor={`${uid}-sex`}>Sex</Label>
              <Select id={`${uid}-sex`} value={sex} onChange={(e) => setSex(e.target.value as Sex | "")}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${uid}-activity`}>Activity</Label>
              <Select
                id={`${uid}-activity`}
                value={activity}
                onChange={(e) => setActivity(e.target.value as ActivityLevel)}
                aria-describedby={`${uid}-activity-hint`}
              >
                {ACTIVITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <FieldHint id={`${uid}-activity-hint`}>{ACTIVITY_OPTIONS.find((o) => o.value === activity)?.hint}</FieldHint>
        </div>
      </GlassCard>

      {/* ─── live preview ─── */}
      <OrbPanel className="p-5 sm:p-7 lg:sticky lg:top-6">
        <p className="sr-only" aria-live="polite">
          {plan && !blocker
            ? `Daily calories ${formatNumber(plan.targets.calories)} kcal${plan.targetDate ? `, estimated around ${formatLongDate(plan.targetDate)}` : ""}.`
            : blocker || ""}
        </p>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-orza-dot shadow-[0_0_12px_rgba(255,180,84,0.85)]" />
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">Live preview</span>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {plan && !blocker ? (
            <motion.div
              key="plan"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mt-6 text-[13px] text-white/60">Your daily calories</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-editorial text-[52px] font-semibold leading-none tracking-[-0.03em] text-white tabular-nums sm:text-[60px]">
                  {formatNumber(plan.targets.calories)}
                </span>
                <span className="text-[15px] text-white/60">kcal</span>
              </div>
              <div className="mt-2 text-[13px] text-white/55">
                {calDelta === 0 ? "Same as your current target" : `${calDelta > 0 ? "+" : "−"}${formatNumber(Math.abs(calDelta))} vs your current ${formatNumber(currentTargets.calories)}`}
              </div>

              <dl className="mt-6 grid grid-cols-3 gap-2">
                {[
                  { k: "Protein", v: `${formatNumber(plan.targets.protein_g)} g` },
                  { k: "Carbs", v: `${formatNumber(plan.targets.carbs_g)} g` },
                  { k: "Fat", v: `${formatNumber(plan.targets.fat_g)} g` },
                ].map((m) => (
                  <div key={m.k} className="rounded-orza-sm border border-white/15 bg-white/[0.07] px-3 py-2.5">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{m.k}</dt>
                    <dd className="mt-1 text-[15px] font-semibold tabular-nums text-white">{m.v}</dd>
                  </div>
                ))}
              </dl>

              <ul className="mt-5 space-y-2 text-[14px] text-white/75">
                <li className="flex justify-between gap-3 border-b border-white/10 pb-2">
                  <span>Maintenance (TDEE)</span>
                  <span className="tabular-nums text-white">{plan.tdee != null ? `${formatNumber(plan.tdee)} kcal` : "—"}</span>
                </li>
                <li className="flex justify-between gap-3 border-b border-white/10 pb-2">
                  <span>Weekly change</span>
                  <span className="tabular-nums text-white">
                    {goal === "maintain" ? "Hold steady" : `${plan.weeklyRate < 0 ? "−" : "+"}${formatPace(plan.weeklyRate, imperial)}`}
                  </span>
                </li>
                <li className="flex justify-between gap-3">
                  <span>Estimated arrival</span>
                  <span className="text-right text-white">
                    {plan.targetDate ? (
                      <>
                        {formatLongDate(plan.targetDate)}
                        <span className="block text-[12px] text-white/50">
                          ~{plan.weeks} week{plan.weeks === 1 ? "" : "s"}
                        </span>
                      </>
                    ) : (
                      "No finish line needed"
                    )}
                  </span>
                </li>
              </ul>

              {plan.paceAdjusted && (
                <p className="mt-4 flex gap-2 rounded-orza-sm border border-[rgba(255,180,84,0.35)] bg-[rgba(255,180,84,0.10)] px-3 py-2.5 text-[13px] leading-snug text-[#FFE7C8]">
                  <Info size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                  To keep your calories at a safe level, ÖRZA will plan a gentler {formatPace(plan.weeklyRate, imperial)} a week.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="py-6"
            >
              {blocker ? (
                <div className="flex gap-3 rounded-orza-sm border border-white/15 bg-white/[0.07] p-4" role="status">
                  <CircleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#FFB454]" aria-hidden />
                  <p className="text-[14px] leading-relaxed text-white/85">{blocker}</p>
                </div>
              ) : (
                <>
                  <p className="mt-2 font-editorial text-[24px] leading-[1.3] text-white">Your plan will appear here as you type.</p>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/60">
                    {missing.length ? `Add your ${missing.join(", ").replace(/, ([^,]*)$/, " and $1")} to see daily calories, macros and an estimated date.` : "Almost there."}
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 border-t border-white/10 pt-5">
          <Button type="submit" variant="hero" size="lg" className="w-full" loading={saving} disabled={!!blocker}>
            {!saving && <Sparkles size={15} strokeWidth={1.75} aria-hidden />}
            {active ? "Save & update my targets" : "Set my goal"}
          </Button>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-white/45">
            AI-powered planning adapts to your lifestyle and progress. Wellness guidance, not medical advice.
          </p>
        </div>
      </OrbPanel>
    </form>
  );
}
