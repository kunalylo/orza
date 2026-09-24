"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, HelpCircle, Info, PencilLine, Search, Undo2, X } from "lucide-react";
import { round, formatNumber } from "@/lib/utils";
import { GlassCard, Tag } from "@/components/orza/primitives";
import { WellnessNote } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { MEAL_LABEL, itemPortion, type TextLogResponse } from "./meal-utils";

/** "Just logged" card under the composer: what ÖRZA understood, anything it couldn't place, and quick fixes. */
export function LoggedResult({
  result,
  onDismiss,
  onUndo,
  onEdit,
  onSearch,
  undoing,
}: {
  result: TextLogResponse;
  onDismiss: () => void;
  onUndo: () => void;
  onEdit: () => void;
  onSearch: (phrase: string) => void;
  undoing?: boolean;
}) {
  const reduce = useReducedMotion();
  const { meal, ai, unmatched, notice } = result;
  const t = meal.totals;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard variant="strong" className="border-[rgba(18,122,86,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <CheckCircle2 size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#127A56]" aria-hidden />
            <div className="min-w-0">
              <div className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">
                Logged to {MEAL_LABEL[meal.meal_type].toLowerCase()}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Tag tone={ai ? "violet" : "neutral"} size="sm">
                  {ai ? "AI estimate" : "Built-in food list"}
                </Tag>
                <span className="font-mono text-[12px] tabular-nums text-orza-muted">
                  {meal.items.length} item{meal.items.length === 1 ? "" : "s"} · {formatNumber(t.calories)} kcal
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-orza-subtle transition-colors duration-150 ease-orza hover:bg-black/5 hover:text-orza-strong"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <ul className="mt-4 divide-y divide-[rgba(20,20,20,0.06)] rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60">
          {meal.items.map((i, idx) => (
            <li key={`${i.name}-${idx}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-orza-strong">{i.name}</div>
                <div className="text-[12px] text-orza-muted">{itemPortion(i)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[13px] tabular-nums text-orza-strong">{formatNumber(i.calories)} kcal</div>
                <div className="text-[11px] tabular-nums text-orza-muted">
                  P {round(i.protein_g, 1)} · C {round(i.carbs_g, 1)} · F {round(i.fat_g, 1)}
                </div>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
            <span className="font-medium text-orza-strong">Total</span>
            <span className="text-right font-mono tabular-nums text-orza-strong">
              {formatNumber(t.calories)} kcal · P {t.protein_g}g · C {t.carbs_g}g · F {t.fat_g}g
            </span>
          </li>
        </ul>

        {meal.notes && (
          <div className="mt-4 rounded-orza-sm border border-[rgba(11,190,220,0.22)] bg-[rgba(11,190,220,0.06)] p-3.5">
            <div className="flex items-start gap-2">
              <HelpCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#0B8FA6]" aria-hidden />
              <p className="text-[14px] leading-relaxed text-orza-strong">{meal.notes}</p>
            </div>
          </div>
        )}

        {notice && (
          <div className="mt-3 flex items-start gap-2 rounded-orza-sm border border-[rgba(176,106,0,0.22)] bg-[#FFF8EE] p-3 text-[13px] leading-relaxed text-[#8A5300]">
            <Info size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            <span>{notice}</span>
          </div>
        )}

        {unmatched.length > 0 && (
          <div className="mt-4">
            <div className="text-[13px] font-medium text-orza-strong">ÖRZA couldn&apos;t place {unmatched.length === 1 ? "this" : "these"}:</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {unmatched.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onSearch(u)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(176,106,0,0.25)] bg-[#FFF4E6] px-3 text-[13px] text-[#8A5300] transition-colors duration-150 ease-orza hover:bg-[#FFECD2]"
                  aria-label={`Search the food list for ${u}`}
                >
                  <Search size={12} strokeWidth={2} aria-hidden /> {u}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-orza-muted">
              Tap one to find it in the food list, or type it again with a portion — e.g. &ldquo;1 katori kadhi&rdquo;.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <PencilLine size={14} strokeWidth={1.75} aria-hidden /> Adjust portions
          </Button>
          <Button variant="ghost" size="sm" onClick={onUndo} loading={undoing}>
            {!undoing && <Undo2 size={14} strokeWidth={1.75} aria-hidden />} Undo
          </Button>
        </div>
        {ai && <WellnessNote className="mt-4" />}
      </GlassCard>
    </motion.div>
  );
}
