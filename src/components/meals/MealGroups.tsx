"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, HelpCircle, ListPlus, PencilLine, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import type { Meal, MealType } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber, round } from "@/lib/utils";
import { Eyebrow, GlassCard, IconTile } from "@/components/orza/primitives";
import { EmptyState } from "@/components/app/ui";
import { Button, ButtonLink } from "@/components/ui/button";
import { Select, Skeleton } from "@/components/ui/form";
import { MEAL_ICON, MEAL_LABEL, MEAL_SINGULAR, MEAL_TYPES, SOURCE_ICON, SOURCE_LABEL, formatTime, itemPortion, sumNutrientsClient } from "./meal-utils";

const GROUP_TONE: Record<MealType, "energy" | "cyan" | "violet" | "neutral"> = {
  breakfast: "energy",
  lunch: "cyan",
  dinner: "violet",
  snack: "neutral",
};

/* ───────────────────────────── Meal card ───────────────────────────── */

function MealCard({
  meal,
  tz,
  onChanged,
  onDeleted,
  onEdit,
}: {
  meal: Meal;
  tz?: string;
  onChanged: (meal: Meal) => void;
  onDeleted: (id: string) => void;
  onEdit: (meal: Meal) => void;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const SourceIcon = SOURCE_ICON[meal.source] ?? UtensilsCrossed;
  const t = meal.totals;
  const quoted = (meal.source === "text" || meal.source === "voice" || meal.source === "chat") && meal.description.trim();
  const time = formatTime(meal.created_at, tz);

  const move = async (to: MealType) => {
    if (to === meal.meal_type) return;
    setMoving(true);
    try {
      const r = await api.patch<{ meal: Meal }>(`/meals/${meal.id}`, { meal_type: to });
      onChanged(r.meal);
      toast.success(`Moved to ${MEAL_SINGULAR[to].toLowerCase()}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setMoving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api.del(`/meals/${meal.id}`);
      onDeleted(meal.id);
      toast.success("Meal removed");
    } catch (e) {
      toast.error(errorMessage(e));
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <GlassCard padded={false} className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-orza-subtle">
            <SourceIcon size={12} strokeWidth={1.75} aria-hidden />
            <span>{SOURCE_LABEL[meal.source] ?? "Logged"}</span>
            {time && (
              <>
                <span aria-hidden>·</span>
                <span className="normal-case tracking-normal">{time}</span>
              </>
            )}
          </div>
          {quoted && <p className="mt-1.5 line-clamp-2 text-[13px] italic leading-snug text-orza-muted">&ldquo;{meal.description}&rdquo;</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-editorial text-[20px] font-semibold leading-6 text-orza-strong tabular-nums">{formatNumber(t.calories)}</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">kcal</div>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-[rgba(20,20,20,0.06)]">
        {meal.items.map((i, idx) => (
          <li key={`${i.name}-${idx}`} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-medium text-orza-strong">{i.name}</div>
              <div className="text-[12px] text-orza-muted">{itemPortion(i)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-[13px] tabular-nums text-orza-strong">{formatNumber(i.calories)}</div>
              <div className="text-[11px] tabular-nums text-orza-muted">
                P {round(i.protein_g, 1)} · C {round(i.carbs_g, 1)} · F {round(i.fat_g, 1)}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {meal.notes && (
        <div className="mt-2 flex items-start gap-2 rounded-orza-sm border border-[rgba(11,190,220,0.22)] bg-[rgba(11,190,220,0.06)] px-3 py-2.5">
          <HelpCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#0B8FA6]" aria-hidden />
          <p className="text-[13px] leading-relaxed text-orza-strong">{meal.notes}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[rgba(20,20,20,0.08)] pt-3">
        <div className="font-mono text-[11px] tabular-nums text-orza-muted">
          P {t.protein_g}g · C {t.carbs_g}g · F {t.fat_g}g · Fibre {t.fiber_g}g
        </div>
        {confirming ? (
          <div className="flex items-center gap-2" role="group" aria-label="Confirm delete">
            <span className="text-[13px] text-orza-strong">Delete this meal?</span>
            <Button variant="ghost" size="sm" className="h-8 px-3" onClick={() => setConfirming(false)} disabled={deleting}>
              Keep
            </Button>
            <Button variant="danger" size="sm" className="h-8 px-3" onClick={remove} loading={deleting} autoFocus>
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <label htmlFor={`move-${meal.id}`} className="sr-only">
              Move to another meal
            </label>
            <Select
              id={`move-${meal.id}`}
              value={meal.meal_type}
              disabled={moving}
              onChange={(e) => move(e.target.value as MealType)}
              className="h-8 w-auto rounded-full bg-white/70 pl-3 pr-8 text-[13px]"
            >
              {MEAL_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {MEAL_SINGULAR[mt]}
                </option>
              ))}
            </Select>
            <button
              type="button"
              onClick={() => onEdit(meal)}
              aria-label="Edit meal"
              title="Edit meal"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-orza-muted transition-colors duration-150 ease-orza hover:bg-white hover:text-orza-strong"
            >
              <PencilLine size={15} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Delete meal"
              title="Delete meal"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-orza-muted transition-colors duration-150 ease-orza hover:bg-[#FDECEC] hover:text-[#B02C2C]"
            >
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

/* ───────────────────────────── Groups ───────────────────────────── */

function GroupsSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading meals">
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="mb-3 flex items-center gap-3">
            <Skeleton className="h-10 w-10 !rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/50 p-5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-4 h-4 w-3/4" />
            <Skeleton className="mt-2.5 h-4 w-2/3" />
            <Skeleton className="mt-5 h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The day's meals grouped Breakfast / Lunch / Dinner / Snacks, with per-group totals and quick add. */
export function MealGroups({
  meals,
  loading,
  dayLabel,
  scanHref,
  tz,
  onAdd,
  onChanged,
  onDeleted,
  onEdit,
}: {
  meals: Meal[];
  loading: boolean;
  dayLabel: string;
  scanHref: string;
  tz?: string;
  onAdd: (type?: MealType) => void;
  onChanged: (meal: Meal) => void;
  onDeleted: (id: string) => void;
  onEdit: (meal: Meal) => void;
}) {
  const reduce = useReducedMotion();
  const total = sumNutrientsClient(meals.map((m) => m.totals)).calories;
  const isToday = dayLabel === "Today";

  return (
    <section aria-labelledby="meal-groups-heading">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>On your plate</Eyebrow>
          <h2 id="meal-groups-heading" className="mt-2 font-editorial text-[26px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[30px]">
            {isToday ? "Today's meals" : dayLabel === "Yesterday" ? "Yesterday's meals" : `Meals · ${dayLabel}`}
          </h2>
        </div>
        {!loading && meals.length > 0 && (
          <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-orza-muted">
            {meals.length} meal{meals.length === 1 ? "" : "s"} · {formatNumber(total)} kcal
          </span>
        )}
      </div>

      {loading ? (
        <GroupsSkeleton />
      ) : meals.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={20} strokeWidth={1.5} />}
          title={isToday ? "Nothing logged yet today" : "Nothing logged for this day"}
          description="Tell ÖRZA what you ate above, snap a photo, or pick from the food list — every entry counts, no judgement."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={scanHref} variant="primary">
                <Camera size={15} strokeWidth={1.75} aria-hidden /> Snap a meal
              </ButtonLink>
              <Button variant="secondary" onClick={() => onAdd()}>
                <ListPlus size={15} strokeWidth={1.75} aria-hidden /> Add from food list
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-7">
          {MEAL_TYPES.map((type) => {
            const list = meals.filter((m) => m.meal_type === type);
            const Icon = MEAL_ICON[type];
            const kcal = sumNutrientsClient(list.map((m) => m.totals)).calories;
            return (
              <div key={type} aria-labelledby={`group-${type}`} role="group">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <IconTile tone={GROUP_TONE[type]}>
                      <Icon size={17} strokeWidth={1.75} aria-hidden />
                    </IconTile>
                    <div>
                      <h3 id={`group-${type}`} className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">
                        {MEAL_LABEL[type]}
                      </h3>
                      <div className="font-mono text-[11px] tabular-nums text-orza-subtle">
                        {list.length ? `${formatNumber(kcal)} kcal` : "Nothing yet"}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onAdd(type)} aria-label={`Add to ${MEAL_LABEL[type].toLowerCase()}`}>
                    <Plus size={14} strokeWidth={2} aria-hidden /> Add
                  </Button>
                </div>
                {list.length > 0 && (
                  <ul className="space-y-3">
                    <AnimatePresence initial={false}>
                      {list.map((m) => (
                        <motion.li
                          key={m.id}
                          layout={!reduce}
                          initial={reduce ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <MealCard meal={m} tz={tz} onChanged={onChanged} onDeleted={onDeleted} onEdit={onEdit} />
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

