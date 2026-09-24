"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatNumber } from "@/lib/utils";
import { EmptyState } from "@/components/app/ui";
import { GlassCard, Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/form";
import { RebalancePlanView } from "@/components/goals/RebalancePlanView";
import { formatShortDate } from "@/components/goals/goal-math";
import type { RebalancePlan } from "@/components/goals/types";

function createdLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function PlanRow({ plan, highlighted, onDelete }: { plan: RebalancePlan; highlighted?: boolean; onDelete: (plan: RebalancePlan) => void }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();
  const n = plan.days.length;
  const first = plan.days[0]?.date;
  const last = plan.days[n - 1]?.date;

  return (
    <GlassCard
      as="li"
      variant={open ? "strong" : "base"}
      padded={false}
      className={cn("overflow-hidden", highlighted && "border-[rgba(255,122,106,0.35)]")}
    >
      <div className="flex items-center gap-2 pr-2 sm:pr-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-orza-md px-4 py-4 text-left transition-colors duration-150 ease-orza hover:bg-white/40 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(11,190,220,0.45)] sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-editorial text-[17px] font-semibold text-orza-strong">{plan.occasion}</span>
              {highlighted && (
                <Tag tone="energy" size="sm">
                  New
                </Tag>
              )}
              {plan.ai && (
                <Tag tone="violet" size="sm" dot={false}>
                  AI
                </Tag>
              )}
            </span>
            <span className="mt-1 block text-[13px] text-orza-muted">
              {formatNumber(plan.extra_calories)} kcal over {n} day{n === 1 ? "" : "s"}
              {first && last ? ` · ${formatShortDate(first)} – ${formatShortDate(last)}` : ""}
              <span className="hidden sm:inline"> · created {createdLabel(plan.created_at)}</span>
            </span>
          </span>
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            aria-hidden
            className={cn("shrink-0 text-orza-muted transition-transform duration-220 ease-orza", open && "rotate-180")}
          />
        </button>
        <Button variant="ghost" size="icon" aria-label={`Delete the ${plan.occasion} plan`} onClick={() => onDelete(plan)} className="shrink-0 hover:text-[#B02C2C]">
          <Trash2 size={16} strokeWidth={1.75} aria-hidden />
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-[rgba(20,20,20,0.08)] px-4 pb-5 pt-5 sm:px-5">
              {plan.description && (
                <p className="mb-4 text-[13px] leading-relaxed text-orza-muted">
                  <span className="font-medium text-orza-strong">What you ate:</span> {plan.description}
                </p>
              )}
              <RebalancePlanView plan={plan} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

/** Past rebalance plans — expand to revisit, delete with confirmation. */
export function RebalanceHistory({
  plans,
  loading,
  highlightId,
  onDeleted,
}: {
  plans: RebalancePlan[];
  loading: boolean;
  highlightId?: string | null;
  onDeleted: (id: string) => void;
}) {
  const [pending, setPending] = React.useState<RebalancePlan | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const confirmDelete = async () => {
    if (!pending) return;
    setDeleting(true);
    try {
      await api.del(`/compensation/${encodeURIComponent(pending.id)}`);
      onDeleted(pending.id);
      toast.success("Plan deleted.");
      setPending(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <ul className="space-y-3" aria-busy="true" aria-label="Loading past plans">
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Skeleton className="h-[74px] rounded-orza-md" />
          </li>
        ))}
      </ul>
    );
  }

  if (!plans.length) {
    return (
      <EmptyState
        icon={<History size={20} strokeWidth={1.75} />}
        title="No plans yet"
        description="Your rebalance plans will live here, so you can look back whenever you need a gentle reset."
      />
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {plans.map((p) => (
          <PlanRow key={p.id} plan={p} highlighted={p.id === highlightId} onDelete={setPending} />
        ))}
      </ul>

      <Dialog open={!!pending} onOpenChange={(o) => !o && !deleting && setPending(null)}>
        <DialogContent title="Delete this plan?" description={pending ? `Your ${pending.occasion} rebalance plan will be removed. This can't be undone.` : undefined}>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary" disabled={deleting}>
                Keep it
              </Button>
            </DialogClose>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              Delete plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
