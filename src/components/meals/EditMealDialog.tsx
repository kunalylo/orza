"use client";
import * as React from "react";
import { toast } from "sonner";
import type { Meal, MealType } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { ItemEditor, draftTotals, draftsValid, fromDraft, toDraft, type DraftItem } from "./ItemEditor";
import { MEAL_SINGULAR, MEAL_TYPES } from "./meal-utils";

/** Fix portions, names or numbers of a logged meal (PATCH /api/meals/[id]). */
export function EditMealDialog({
  meal,
  onOpenChange,
  onSaved,
}: {
  meal: Meal | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (meal: Meal) => void;
}) {
  const [rows, setRows] = React.useState<DraftItem[]>([]);
  const [mealType, setMealType] = React.useState<MealType>("lunch");
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!meal) return;
    setRows(meal.items.map(toDraft));
    setMealType(meal.meal_type);
    setShowErrors(false);
  }, [meal]);

  const totals = draftTotals(rows);

  const save = async () => {
    if (!meal) return;
    setShowErrors(true);
    if (!draftsValid(rows)) {
      toast.error(rows.length ? "Please check the highlighted fields." : "Add at least one item — or delete the meal instead.");
      return;
    }
    setSaving(true);
    try {
      const r = await api.patch<{ meal: Meal }>(`/meals/${meal.id}`, { items: rows.map(fromDraft), meal_type: mealType });
      toast.success("Meal updated");
      onSaved(r.meal);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!meal} onOpenChange={onOpenChange}>
      <DialogContent
        title="Edit meal"
        description="Adjust names, portions or numbers. Changing a quantity rescales that item's nutrition."
        className="sm:w-[min(640px,calc(100%-32px))]"
      >
        <ItemEditor rows={rows} onChange={setRows} idPrefix="edit" showErrors={showErrors} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 px-3.5 py-2.5 text-[13px]">
          <span className="text-orza-muted">Meal total</span>
          <span className="font-mono tabular-nums text-orza-strong">
            {formatNumber(totals.calories)} kcal · P {totals.protein_g}g · C {totals.carbs_g}g · F {totals.fat_g}g
          </span>
        </div>
        <div className="mt-4">
          <span className="mb-1.5 block text-[13px] font-medium text-orza-strong">Meal</span>
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented aria-label="Meal type" size="sm" value={mealType} onChange={setMealType} options={MEAL_TYPES.map((t) => ({ value: t, label: MEAL_SINGULAR[t] }))} />
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
