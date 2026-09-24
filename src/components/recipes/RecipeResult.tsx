"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Info, RotateCw, X } from "lucide-react";
import { GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { RecipeDetail } from "./RecipeDetail";
import type { RecipeItem } from "./types";

const STEPS = ["Checking your diet and allergies…", "Balancing protein, carbs and fibre…", "Measuring out the ingredients…", "Writing the method…"];

/** Shown while a recipe is being created. */
export function GeneratingCard() {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % STEPS.length), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <GlassCard variant="strong" padded={false} className="overflow-hidden p-5 sm:p-7" aria-live="polite" aria-busy>
      <div className="flex items-center gap-4">
        <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center" aria-hidden>
          <span className="absolute inset-0 animate-orza-pulse rounded-full bg-[radial-gradient(circle,rgba(255,180,84,0.55)_0%,rgba(255,122,106,0.25)_45%,rgba(255,95,162,0)_72%)]" />
          <span className="h-4 w-4 rounded-full bg-orza-dot shadow-[0_0_24px_rgba(255,122,106,0.6)]" />
        </span>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">ÖRZA is cooking</div>
          <div className="mt-1 text-[15px] text-orza-strong">{STEPS[i]}</div>
        </div>
      </div>
      <div className="mt-6 space-y-3" aria-hidden>
        <div className="orza-skeleton h-8 w-2/3 rounded-orza-xs" />
        <div className="orza-skeleton h-4 w-full rounded-orza-xs" />
        <div className="orza-skeleton h-16 w-full rounded-orza-sm" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="orza-skeleton h-32 rounded-orza-sm" />
          <div className="orza-skeleton h-32 rounded-orza-sm" />
        </div>
      </div>
    </GlassCard>
  );
}

/** The freshly generated recipe, with save / log / regenerate actions. */
export function RecipeResult({
  recipe,
  notice,
  onClose,
  onAnother,
  generating,
  onToggleSave,
  saving,
  onLog,
  logging,
}: {
  recipe: RecipeItem;
  notice?: string;
  onClose: () => void;
  onAnother: () => void;
  generating: boolean;
  onToggleSave: () => void;
  saving: boolean;
  onLog: () => void;
  logging: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={recipe.id}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-5 sm:p-8">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-orza-energy" />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,180,84,0.20) 0%, rgba(255,122,106,0.08) 45%, rgba(251,247,241,0) 70%)" }}
        />
        <div className="relative">
          <RecipeDetail
            recipe={recipe}
            layout="wide"
            onToggleSave={onToggleSave}
            saving={saving}
            onLog={onLog}
            logging={logging}
            aside={
              <div className="-mr-2 flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" onClick={onAnother} disabled={generating} className="px-3" title="Generate another with the same request">
                  <RotateCw size={14} strokeWidth={1.9} aria-hidden />
                  <span className="hidden sm:inline">Another</span>
                  <span className="sr-only sm:hidden">Generate another</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close recipe" className="h-9 w-9">
                  <X size={16} strokeWidth={1.9} />
                </Button>
              </div>
            }
            notice={
              notice ? (
                <div className="mt-4 flex max-w-2xl items-start gap-2.5 rounded-orza-sm border border-[rgba(11,143,166,0.20)] bg-[#EAF6FF]/80 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#0A6F82]">
                  <Info size={15} strokeWidth={1.9} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{notice}</span>
                </div>
              ) : undefined
            }
          />
        </div>
      </GlassCard>
    </motion.div>
  );
}
