"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  CircleAlert,
  Crop,
  HelpCircle,
  Keyboard,
  MessageSquareText,
  RotateCw,
  ShieldCheck,
  Sparkles,
  SunMedium,
  UtensilsCrossed,
  WifiOff,
} from "lucide-react";
import type { Meal, MealType, Scan } from "@/lib/types";
import { clamp, formatNumber, round } from "@/lib/utils";
import { Eyebrow, GlassCard, IconTile, Tag } from "@/components/orza/primitives";
import { WellnessNote } from "@/components/app/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { ItemEditor, draftTotals, type DraftItem } from "./ItemEditor";
import { MEAL_LABEL, MEAL_SINGULAR, MEAL_TYPES, confidenceTone } from "./meal-utils";

const panelMotion = (reduce: boolean | null) => ({
  initial: reduce ? false : { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
});

/* ───────────────────────────── Tips ───────────────────────────── */

const TIPS = [
  { icon: SunMedium, title: "Good, even light", body: "Daylight or a bright room works best — avoid harsh shadows and flash glare." },
  { icon: Crop, title: "The whole plate in frame", body: "Shoot from slightly above so every katori, roti and side is visible." },
  { icon: UtensilsCrossed, title: "One plate at a time", body: "Scan shared dishes or a second helping separately for a truer estimate." },
  { icon: MessageSquareText, title: "Add what the camera can't see", body: "Homemade or restaurant, extra ghee, half eaten — a short note sharpens the numbers." },
];

export function ScanTips({ scanCost }: { scanCost: number }) {
  return (
    <GlassCard variant="strong">
      <Eyebrow className="text-[11px]">For the best estimate</Eyebrow>
      <h2 className="mt-1.5 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">Snap tips</h2>
      <ul className="mt-4 space-y-3.5">
        {TIPS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <IconTile tone="cyan" className="h-9 w-9">
              <Icon size={16} strokeWidth={1.75} aria-hidden />
            </IconTile>
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-orza-strong">{title}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-orza-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-5 space-y-2 border-t border-[rgba(20,20,20,0.08)] pt-4 text-[12px] leading-relaxed text-orza-muted">
        <p className="flex items-start gap-2">
          <Sparkles size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#E0593F]" aria-hidden />
          <span>
            Each scan uses {scanCost} AI credits — refunded automatically if ÖRZA can&apos;t read the photo. Typing or speaking your meal is cheaper, and the food list is free.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#127A56]" aria-hidden />
          <span>Your photo is resized on your device and used only for this analysis — ÖRZA doesn&apos;t keep it.</span>
        </p>
      </div>
    </GlassCard>
  );
}

/* ───────────────────────────── Status panels ───────────────────────────── */

function StatusPanel({
  icon,
  tone,
  eyebrow,
  title,
  children,
  actions,
}: {
  icon: React.ReactNode;
  tone: "energy" | "cyan" | "violet" | "neutral";
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div {...panelMotion(reduce)}>
      <GlassCard variant="strong" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-60 blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(255,180,84,0.24) 0%, rgba(255,122,106,0.12) 45%, rgba(255,95,162,0) 70%)" }}
        />
        <div className="relative">
          <IconTile tone={tone}>{icon}</IconTile>
          <Eyebrow className="mt-4 text-[11px]">{eyebrow}</Eyebrow>
          <h2 className="mt-1.5 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">{title}</h2>
          <div className="mt-2 text-[14px] leading-relaxed text-orza-muted">{children}</div>
          <div className="mt-5 flex flex-wrap gap-2">{actions}</div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

export function AiDisabledPanel({ message, mealsHref }: { message?: string; mealsHref: string }) {
  return (
    <StatusPanel
      icon={<WifiOff size={17} strokeWidth={1.75} aria-hidden />}
      tone="neutral"
      eyebrow="Snap & Know"
      title="Photo scanning isn't switched on yet"
      actions={
        <>
          <ButtonLink href={mealsHref} variant="primary">
            <Keyboard size={15} strokeWidth={1.75} aria-hidden /> Type or speak your meal
          </ButtonLink>
        </>
      }
    >
      <p>
        {message ||
          "Photo scanning needs ÖRZA's AI, which isn't switched on yet. You can type or speak your meal instead."}
      </p>
      <p className="mt-2">
        The meal log understands English, Hindi and Hinglish — &ldquo;do roti, ek katori dal&rdquo; works — and the food list is always free.
      </p>
    </StatusPanel>
  );
}

export function NoCreditsPanel({ mealsHref, onRetry }: { mealsHref: string; onRetry?: () => void }) {
  return (
    <StatusPanel
      icon={<Sparkles size={17} strokeWidth={1.75} aria-hidden />}
      tone="energy"
      eyebrow="AI credits"
      title="You're out of AI credits"
      actions={
        <>
          <ButtonLink href="/dashboard/credits" variant="primary">
            Get more credits <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </ButtonLink>
          <ButtonLink href={mealsHref} variant="secondary">
            Log it for free
          </ButtonLink>
          {onRetry && (
            <Button variant="ghost" onClick={onRetry}>
              <RotateCw size={14} strokeWidth={1.75} aria-hidden /> Try again
            </Button>
          )}
        </>
      }
    >
      <p>Photo scans use AI credits. Top up to keep snapping — or log this meal from the food list, which never uses credits.</p>
    </StatusPanel>
  );
}

export function ScanErrorPanel({ message, onRetry, onPickAnother }: { message: string; onRetry?: () => void; onPickAnother: () => void }) {
  return (
    <StatusPanel
      icon={<CircleAlert size={17} strokeWidth={1.75} aria-hidden />}
      tone="violet"
      eyebrow="Couldn't finish the scan"
      title="Let's try that again"
      actions={
        <>
          {onRetry && (
            <Button variant="primary" onClick={onRetry}>
              <RotateCw size={14} strokeWidth={1.75} aria-hidden /> Try again
            </Button>
          )}
          <Button variant="secondary" onClick={onPickAnother}>
            <Camera size={15} strokeWidth={1.75} aria-hidden /> Use another photo
          </Button>
        </>
      }
    >
      <p>{message}</p>
      <p className="mt-2 text-[13px]">When a scan can&apos;t be completed, its credits are refunded automatically.</p>
    </StatusPanel>
  );
}

export function LoggedPanel({ meal, mealsHref, onScanAnother }: { meal: Meal; mealsHref: string; onScanAnother: () => void }) {
  return (
    <StatusPanel
      icon={<CheckCircle2 size={17} strokeWidth={1.75} aria-hidden />}
      tone="cyan"
      eyebrow="Logged"
      title={`Added to ${MEAL_LABEL[meal.meal_type].toLowerCase()}`}
      actions={
        <>
          <ButtonLink href={mealsHref} variant="primary">
            View meal log <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </ButtonLink>
          <Button variant="secondary" onClick={onScanAnother}>
            <Camera size={15} strokeWidth={1.75} aria-hidden /> Scan another
          </Button>
        </>
      }
    >
      <p>
        <span className="font-medium text-orza-strong">{meal.description}</span> — {meal.items.length} item{meal.items.length === 1 ? "" : "s"},{" "}
        <span className="font-mono tabular-nums text-orza-strong">{formatNumber(meal.totals.calories)} kcal</span>.
      </p>
      <p className="mt-2 font-mono text-[12px] tabular-nums">
        P {meal.totals.protein_g}g · C {meal.totals.carbs_g}g · F {meal.totals.fat_g}g · Fibre {meal.totals.fiber_g}g
      </p>
    </StatusPanel>
  );
}

/* ───────────────────────────── Result review ───────────────────────────── */

/** Honest range around the estimate — wider when ÖRZA is less sure. */
function estimateRange(kcal: number, confidence: number) {
  const spread = clamp(0.1 + (1 - confidence) * 0.35, 0.1, 0.35);
  return { low: Math.max(0, Math.round((kcal * (1 - spread)) / 10) * 10), high: Math.round((kcal * (1 + spread)) / 10) * 10 };
}

export function ScanResultPanel({
  scan,
  rows,
  onRowsChange,
  mealType,
  onMealTypeChange,
  dayLabel,
  showErrors,
  logging,
  onLog,
  onReset,
}: {
  scan: Scan;
  rows: DraftItem[];
  onRowsChange: (rows: DraftItem[]) => void;
  mealType: MealType;
  onMealTypeChange: (t: MealType) => void;
  dayLabel: string;
  showErrors: boolean;
  logging: boolean;
  onLog: () => void;
  onReset: () => void;
}) {
  const reduce = useReducedMotion();
  const totals = draftTotals(rows);
  const conf = confidenceTone(scan.confidence);
  const range = estimateRange(totals.calories, scan.confidence);
  const cells = [
    { label: "kcal", value: formatNumber(totals.calories) },
    { label: "Protein", value: `${round(totals.protein_g, 1)}g` },
    { label: "Carbs", value: `${round(totals.carbs_g, 1)}g` },
    { label: "Fat", value: `${round(totals.fat_g, 1)}g` },
  ];

  return (
    <motion.div {...panelMotion(reduce)}>
      <GlassCard variant="strong" as="section" aria-labelledby="scan-result-title">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
          <Sparkles size={12} strokeWidth={1.75} className="text-[#0B8FA6]" aria-hidden />
          ÖRZA analysis
        </div>
        <h2 id="scan-result-title" className="mt-2 font-editorial text-[24px] font-semibold leading-8 tracking-[-0.01em] text-orza-strong">
          {scan.dish_name}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Tag tone={conf.tone} size="sm">
            {conf.label}
          </Tag>
          <span className="font-mono text-[11px] tabular-nums text-orza-subtle">{Math.round(scan.confidence * 100)}% sure</span>
        </div>

        {scan.notes && (
          <div className="mt-4 rounded-orza-sm border border-[rgba(11,190,220,0.22)] bg-[rgba(11,190,220,0.06)] p-3.5">
            <div className="flex items-start gap-2">
              <HelpCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#0B8FA6]" aria-hidden />
              <p className="text-[14px] leading-relaxed text-orza-strong">{scan.notes}</p>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Meal totals">
          {cells.map((c) => (
            <div key={c.label} className="rounded-orza-sm border border-[rgba(20,20,20,0.06)] bg-white/70 px-1.5 py-2 text-center">
              <div className="font-editorial text-[17px] font-semibold leading-6 text-orza-strong tabular-nums">{c.value}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">{c.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[12px] text-orza-muted">
          <span>Estimated range</span>
          <span className="font-mono tabular-nums text-orza-strong">
            {formatNumber(range.low)}–{formatNumber(range.high)} kcal
          </span>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-orza-strong">Detected items</h3>
            <span className="text-[12px] text-orza-subtle">Edit anything that looks off</span>
          </div>
          <ItemEditor rows={rows} onChange={onRowsChange} idPrefix="scan" showErrors={showErrors} narrow />
        </div>

        <div className="mt-5 border-t border-[rgba(20,20,20,0.08)] pt-5">
          <span id="scan-meal-type" className="mb-1.5 block text-[13px] font-medium text-orza-strong">
            Log to <span className="font-normal text-orza-muted">· {dayLabel}</span>
          </span>
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented aria-labelledby="scan-meal-type" size="sm" value={mealType} onChange={onMealTypeChange} options={MEAL_TYPES.map((t) => ({ value: t, label: MEAL_SINGULAR[t] }))} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onLog} loading={logging} disabled={rows.length === 0} className="min-w-0 flex-[1_1_180px]" size="lg">
            {!logging && <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />} Log this meal
          </Button>
          <Button variant="secondary" onClick={onReset} disabled={logging} size="lg" className="min-w-0 flex-[1_1_140px]">
            <Camera size={15} strokeWidth={1.75} aria-hidden /> Scan another
          </Button>
        </div>
        <WellnessNote className="mt-4" />
      </GlassCard>
    </motion.div>
  );
}
