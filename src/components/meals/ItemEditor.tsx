"use client";
import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MealItem, Nutrients } from "@/lib/types";
import { cn, round } from "@/lib/utils";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/orza/primitives";
import { sumNutrientsClient } from "./meal-utils";

/**
 * Editable meal-item rows (Snap & Know review, meal edits, custom items).
 * Numbers are kept as strings while typing; `per` holds per-unit values so changing
 * the quantity rescales nutrition without rounding drift.
 */
export type DraftItem = {
  uid: string;
  name: string;
  unit: string;
  quantity: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: number;
  grams?: number;
  confidence?: number;
  per: Nutrients & { grams?: number };
};

type NumField = "calories" | "protein_g" | "carbs_g" | "fat_g";
export const MAX_ITEMS = 20;

let seq = 0;
const uid = () => `item-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** "1,5" / " 2 " → number; "" or junk → NaN. */
export function toNum(s: string): number {
  const t = s.trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export function toDraft(i: MealItem): DraftItem {
  const q = i.quantity > 0 ? i.quantity : 1;
  return {
    uid: uid(),
    name: i.name,
    unit: i.unit,
    quantity: String(round(q, 2)),
    calories: String(Math.round(i.calories)),
    protein_g: String(round(i.protein_g, 1)),
    carbs_g: String(round(i.carbs_g, 1)),
    fat_g: String(round(i.fat_g, 1)),
    fiber_g: i.fiber_g || 0,
    grams: i.grams,
    confidence: i.confidence,
    per: {
      calories: i.calories / q,
      protein_g: i.protein_g / q,
      carbs_g: i.carbs_g / q,
      fat_g: i.fat_g / q,
      fiber_g: (i.fiber_g || 0) / q,
      grams: i.grams != null ? i.grams / q : undefined,
    },
  };
}

export function blankDraft(): DraftItem {
  return {
    uid: uid(),
    name: "",
    unit: "serving",
    quantity: "1",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
    fiber_g: 0,
    per: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  };
}

type RowErrors = Partial<Record<"name" | "quantity" | NumField, boolean>>;

export function rowErrors(d: DraftItem): RowErrors {
  const q = toNum(d.quantity);
  const kcal = toNum(d.calories);
  const macro = (s: string, max: number) => s.trim() !== "" && !(toNum(s) >= 0 && toNum(s) <= max);
  const e: RowErrors = {};
  if (!d.name.trim()) e.name = true;
  if (!(q > 0 && q <= 100)) e.quantity = true;
  if (!(kcal >= 0 && kcal <= 5000)) e.calories = true;
  if (macro(d.protein_g, 500)) e.protein_g = true;
  if (macro(d.carbs_g, 1000)) e.carbs_g = true;
  if (macro(d.fat_g, 500)) e.fat_g = true;
  return e;
}

export const draftsValid = (rows: DraftItem[]) => rows.length > 0 && rows.every((r) => Object.keys(rowErrors(r)).length === 0);

/** Convert a valid draft to the API item shape. */
export function fromDraft(d: DraftItem): MealItem {
  const n = (s: string) => Math.max(0, toNum(s) || 0);
  return {
    name: d.name.trim(),
    quantity: round(toNum(d.quantity), 2),
    unit: d.unit.trim() || "serving",
    grams: d.grams != null ? Math.min(5000, Math.round(d.grams)) : undefined,
    calories: Math.round(n(d.calories)),
    protein_g: round(n(d.protein_g), 1),
    carbs_g: round(n(d.carbs_g), 1),
    fat_g: round(n(d.fat_g), 1),
    fiber_g: round(d.fiber_g || 0, 1),
    confidence: d.confidence,
  };
}

export function draftTotals(rows: DraftItem[]): Nutrients {
  const n = (s: string) => Math.max(0, toNum(s) || 0);
  return sumNutrientsClient(
    rows.map((r) => ({ calories: n(r.calories), protein_g: n(r.protein_g), carbs_g: n(r.carbs_g), fat_g: n(r.fat_g), fiber_g: r.fiber_g }))
  );
}

/** Apply a field edit, rescaling nutrition when the quantity changes. */
function applyEdit(row: DraftItem, field: "name" | "unit" | "quantity" | NumField, value: string): DraftItem {
  if (field === "name" || field === "unit") return { ...row, [field]: value };
  if (field === "quantity") {
    const q = toNum(value);
    if (!(q > 0)) return { ...row, quantity: value };
    const p = row.per;
    // Blank custom rows have no per-unit values yet — don't overwrite what the user typed.
    const hasBase = p.calories > 0 || p.protein_g > 0 || p.carbs_g > 0 || p.fat_g > 0;
    if (!hasBase) return { ...row, quantity: value };
    return {
      ...row,
      quantity: value,
      calories: String(Math.round(p.calories * q)),
      protein_g: String(round(p.protein_g * q, 1)),
      carbs_g: String(round(p.carbs_g * q, 1)),
      fat_g: String(round(p.fat_g * q, 1)),
      fiber_g: round(p.fiber_g * q, 1),
      grams: p.grams != null ? Math.round(p.grams * q) : row.grams,
    };
  }
  const v = toNum(value);
  const q = toNum(row.quantity);
  const per = v >= 0 && q > 0 ? { ...row.per, [field]: v / q } : row.per;
  return { ...row, [field]: value, per };
}

function Field({
  id,
  label,
  value,
  onChange,
  invalid,
  numeric = true,
  placeholder,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  numeric?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength ?? (numeric ? 8 : undefined)}
        onChange={(e) => onChange(e.target.value)}
        inputMode={numeric ? "decimal" : undefined}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={cn(
          "h-9 rounded-orza-xs px-2.5 text-[14px]",
          numeric && "tabular-nums",
          invalid && "border-[rgba(176,44,44,0.55)] focus:border-[#B02C2C] focus:shadow-[0_0_0_3px_rgba(176,44,44,0.14)]"
        )}
      />
    </div>
  );
}

export function ItemEditor({
  rows,
  onChange,
  idPrefix = "item",
  showErrors = false,
  addLabel = "Add item",
  narrow = false,
  className,
}: {
  rows: DraftItem[];
  onChange: (rows: DraftItem[]) => void;
  idPrefix?: string;
  /** Highlight invalid fields (e.g. after a submit attempt). Blank new rows stay calm until then. */
  showErrors?: boolean;
  addLabel?: string;
  /** Keep the number fields in two rows of three (for side panels that stay narrow on desktop). */
  narrow?: boolean;
  className?: string;
}) {
  const update = (id: string, field: Parameters<typeof applyEdit>[1], value: string) =>
    onChange(rows.map((r) => (r.uid === id ? applyEdit(r, field, value) : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.uid !== id));
  const add = () => onChange([...rows, blankDraft()]);

  return (
    <div className={className}>
      <ul className="space-y-2.5">
        {rows.map((r, idx) => {
          const errs = showErrors ? rowErrors(r) : {};
          const base = `${idPrefix}-${r.uid}`;
          const low = r.confidence != null && r.confidence < 0.55;
          return (
            <li key={r.uid} className="rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/65 p-3">
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field
                    id={`${base}-name`}
                    label={`Item ${idx + 1}`}
                    value={r.name}
                    numeric={false}
                    maxLength={80}
                    placeholder="e.g. Dal tadka"
                    invalid={errs.name}
                    onChange={(v) => update(r.uid, "name", v)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.uid)}
                  aria-label={`Remove ${r.name.trim() || `item ${idx + 1}`}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-orza-subtle transition-colors duration-150 ease-orza hover:bg-[#FDECEC] hover:text-[#B02C2C]"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
              {low && (
                <div className="mt-2">
                  <Tag tone="warning" size="sm">
                    ÖRZA wasn&apos;t sure about this one — please check
                  </Tag>
                </div>
              )}
              <div className={cn("mt-2 grid grid-cols-3 gap-2", !narrow && "sm:grid-cols-6")}>
                <Field id={`${base}-qty`} label="Qty" value={r.quantity} invalid={errs.quantity} onChange={(v) => update(r.uid, "quantity", v)} />
                <Field id={`${base}-unit`} label="Unit" value={r.unit} numeric={false} maxLength={24} onChange={(v) => update(r.uid, "unit", v)} />
                <Field id={`${base}-kcal`} label="kcal" value={r.calories} invalid={errs.calories} placeholder="0" onChange={(v) => update(r.uid, "calories", v)} />
                <Field id={`${base}-p`} label="Protein g" value={r.protein_g} invalid={errs.protein_g} placeholder="0" onChange={(v) => update(r.uid, "protein_g", v)} />
                <Field id={`${base}-c`} label="Carbs g" value={r.carbs_g} invalid={errs.carbs_g} placeholder="0" onChange={(v) => update(r.uid, "carbs_g", v)} />
                <Field id={`${base}-f`} label="Fat g" value={r.fat_g} invalid={errs.fat_g} placeholder="0" onChange={(v) => update(r.uid, "fat_g", v)} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={add} disabled={rows.length >= MAX_ITEMS}>
          <Plus size={14} strokeWidth={2} aria-hidden /> {addLabel}
        </Button>
        <span className="text-[11px] text-orza-subtle">Changing a quantity rescales its nutrition.</span>
      </div>
      {showErrors && rows.length === 0 && <p className="mt-2 text-xs text-[#B02C2C]">Add at least one item.</p>}
    </div>
  );
}
