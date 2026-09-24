"use client";
import * as React from "react";
import { toast } from "sonner";
import { ArrowLeft, Minus, Plus, Search, UtensilsCrossed } from "lucide-react";
import type { Meal, MealType } from "@/lib/types";
import { conflictsWithAllergies } from "@/lib/allergens";
import { dietAllowsFood } from "@/lib/nutrition/diet-rules";
import { maxServingsFor } from "@/lib/nutrition/limits";
import { useUser } from "@/components/app/UserProvider";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber, round } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Segmented, Skeleton } from "@/components/ui/form";
import { ItemEditor, blankDraft, draftTotals, draftsValid, fromDraft, type DraftItem } from "./ItemEditor";
import { MEAL_SINGULAR, MEAL_TYPES, fmtQty, type FoodDietMark, type FoodHit } from "./meal-utils";

/** Search shortcuts, in order of popularity; filtered by the user's diet and allergies before showing. */
const QUICK_PICKS: { label: string; diet: FoodDietMark }[] = [
  { label: "Roti", diet: "vegan" },
  { label: "Dal", diet: "vegan" },
  { label: "Rice", diet: "vegan" },
  { label: "Poha", diet: "vegan" },
  { label: "Idli", diet: "vegan" },
  { label: "Dosa", diet: "vegan" },
  { label: "Paneer", diet: "veg" },
  { label: "Chai", diet: "veg" },
  { label: "Egg", diet: "egg" },
  { label: "Banana", diet: "vegan" },
  { label: "Curd", diet: "veg" },
  { label: "Upma", diet: "vegan" },
  { label: "Oats", diet: "vegan" },
  { label: "Sprouts", diet: "vegan" },
  { label: "Apple", diet: "vegan" },
];
const QUICK_PICK_COUNT = 10;

const DIET: Record<FoodDietMark, { color: string; label: string }> = {
  veg: { color: "#127A56", label: "Vegetarian" },
  vegan: { color: "#127A56", label: "Vegan" },
  egg: { color: "#B06A00", label: "Contains egg" },
  nonveg: { color: "#B02C2C", label: "Non-vegetarian" },
};

/** The familiar Indian veg / non-veg square mark. */
export function DietMark({ diet }: { diet: FoodDietMark }) {
  const d = DIET[diet] || DIET.veg;
  return (
    <span
      title={d.label}
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px]"
      style={{ borderColor: d.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
      <span className="sr-only">{d.label}</span>
    </span>
  );
}

function Stepper({ value, onChange, min = 0.5, max = 20, step = 0.5 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = React.useState(String(value));
  React.useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n) && n > 0) onChange(Math.min(max, Math.max(min, round(n, 2))));
    else setDraft(String(value));
  };
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-full text-orza-strong transition-colors duration-150 ease-orza hover:bg-[rgba(20,20,20,0.06)] disabled:opacity-35 disabled:pointer-events-none";
  return (
    <div className="inline-flex items-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white/85 p-1">
      <button type="button" className={btn} aria-label="Fewer servings" disabled={value <= min} onClick={() => onChange(Math.max(min, round(value - step, 2)))}>
        <Minus size={14} strokeWidth={2} />
      </button>
      <input
        aria-label="Servings"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && commit((e.target as HTMLInputElement).value)}
        className="w-12 bg-transparent text-center text-[15px] font-medium tabular-nums text-orza-strong focus:outline-none"
      />
      <button type="button" className={btn} aria-label="More servings" disabled={value >= max} onClick={() => onChange(Math.min(max, round(value + step, 2)))}>
        <Plus size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function NutrientGrid({ calories, protein, carbs, fat, approx }: { calories: number; protein: number; carbs: number; fat: number; approx?: boolean }) {
  const cells = [
    { label: "kcal", value: formatNumber(calories) },
    { label: "Protein", value: `${round(protein, 1)}g` },
    { label: "Carbs", value: `${round(carbs, 1)}g` },
    { label: "Fat", value: `${round(fat, 1)}g` },
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-orza-sm border border-[rgba(20,20,20,0.06)] bg-white/70 px-2 py-2 text-center">
          <div className="font-editorial text-[17px] font-semibold leading-6 text-orza-strong tabular-nums">
            {approx && c.label === "kcal" ? "≈" : ""}
            {c.value}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function MealTypePicker({ value, onChange }: { value: MealType; onChange: (v: MealType) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-medium text-orza-strong">Add to</span>
      <Segmented
        size="sm"
        value={value}
        onChange={onChange}
        options={MEAL_TYPES.map((t) => ({ value: t, label: MEAL_SINGULAR[t] }))}
        className="no-scrollbar max-w-full overflow-x-auto"
      />
    </div>
  );
}

/** "Add from food list": debounced search of ÖRZA's food list, or custom items (e.g. from a nutrition label). */
export function FoodPickerDialog({
  open,
  onOpenChange,
  date,
  defaultMealType,
  initialQuery,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  defaultMealType: MealType;
  initialQuery?: string;
  onAdded: (meal: Meal) => void;
}) {
  const { user } = useUser();
  const [tab, setTab] = React.useState<"search" | "custom">("search");
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<FoodHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<FoodHit | null>(null);
  const [qty, setQty] = React.useState(1);
  const [style, setStyle] = React.useState<"home" | "restaurant">("home");
  const [mealType, setMealType] = React.useState<MealType>(defaultMealType);
  const [custom, setCustom] = React.useState<DraftItem[]>(() => [blankDraft()]);
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Fresh state every time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setTab("search");
    setQ(initialQuery ?? "");
    setSelected(null);
    setQty(1);
    setStyle("home");
    setMealType(defaultMealType);
    setCustom([blankDraft()]);
    setShowErrors(false);
  }, [open, initialQuery, defaultMealType]);

  // Debounced search.
  React.useEffect(() => {
    if (!open || tab !== "search") return;
    const term = q.trim();
    if (!term) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.get<{ foods: FoodHit[] }>(`/foods/search?q=${encodeURIComponent(term)}`);
        if (cancelled) return;
        setResults(Array.isArray(r?.foods) ? r.foods : []);
        setSearchError(null);
      } catch (e) {
        if (cancelled) return;
        setResults([]);
        setSearchError(errorMessage(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, tab]);

  const diet = user.profile?.diet;
  const allergies = user.profile?.allergies;
  const quickPicks = React.useMemo(
    () =>
      QUICK_PICKS.filter((p) => dietAllowsFood(diet, p.diet) && !conflictsWithAllergies(p.label, allergies))
        .slice(0, QUICK_PICK_COUNT)
        .map((p) => p.label),
    [diet, allergies]
  );

  // One entry holds at most 20 servings, and never more than the per-item limits allow for rich dishes.
  const maxQty = selected ? Math.max(0.5, Math.floor(maxServingsFor(selected, style === "restaurant") * 2) / 2) : 20;
  React.useEffect(() => {
    if (qty > maxQty) setQty(maxQty);
  }, [qty, maxQty]);

  const preview = React.useMemo(() => {
    if (!selected) return null;
    const p = selected.per_serving;
    let calories = p.calories * qty;
    let fat = p.fat_g * qty;
    const m = selected.restaurant_multiplier;
    if (style === "restaurant" && m && m > 1) {
      // Extra restaurant calories come mostly from oil, butter and cream.
      const extra = calories * (m - 1);
      calories += extra;
      fat += extra / 9;
    }
    return { calories, protein: p.protein_g * qty, carbs: p.carbs_g * qty, fat, approx: style === "restaurant" };
  }, [selected, qty, style]);

  const addFood = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await api.post<{ meal: Meal }>("/meals/manual", {
        food_key: selected.key,
        quantity: qty,
        restaurant: style === "restaurant",
        meal_type: mealType,
        date,
      });
      toast.success(`Added ${fmtQty(qty)} × ${selected.name} to ${MEAL_SINGULAR[mealType].toLowerCase()}`);
      onAdded(r.meal);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addCustom = async () => {
    setShowErrors(true);
    if (!draftsValid(custom)) {
      toast.error("Please check the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const r = await api.post<{ meal: Meal }>("/meals/manual", { items: custom.map(fromDraft), meal_type: mealType, date });
      toast.success(`Added to ${MEAL_SINGULAR[mealType].toLowerCase()}`);
      onAdded(r.meal);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const customTotals = draftTotals(custom);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add from food list"
        description="Search ÖRZA's Indian & global food list, or add your own item from a nutrition label."
        className="sm:w-[min(600px,calc(100%-32px))]"
      >
        <Segmented
          size="sm"
          value={tab}
          onChange={(v) => setTab(v)}
          options={[
            { value: "search", label: "Search foods" },
            { value: "custom", label: "Custom item" },
          ]}
        />

        {tab === "search" && !selected && (
          <div className="mt-4">
            <div className="relative">
              <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-orza-subtle" aria-hidden />
              <Input
                autoFocus
                type="search"
                aria-label="Search foods"
                placeholder="Try roti, dal makhani, poha, dosa…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10"
              />
            </div>

            {!q.trim() && quickPicks.length > 0 && (
              <div className="mt-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Popular</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {quickPicks.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQ(p)}
                      className="h-8 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/70 px-3.5 text-[13px] text-orza-muted transition-colors duration-150 ease-orza hover:bg-white hover:text-orza-strong"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {q.trim() && (
              <div className="mt-3 max-h-[min(340px,45dvh)] overflow-y-auto rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/55 p-1.5" aria-live="polite" aria-busy={searching}>
                {searching && results.length === 0 ? (
                  <div className="space-y-1.5 p-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : searchError ? (
                  <p className="px-3 py-6 text-center text-sm text-orza-muted">{searchError}</p>
                ) : results.length === 0 ? (
                  <div className="px-4 py-7 text-center">
                    <UtensilsCrossed size={20} strokeWidth={1.5} className="mx-auto text-orza-subtle" aria-hidden />
                    <p className="mt-2 text-sm font-medium text-orza-strong">No match for “{q.trim()}”</p>
                    <p className="mt-1 text-[13px] text-orza-muted">
                      Try a simpler name, describe it in your own words in the composer, or add it as a custom item.
                    </p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => setTab("custom")}>
                      Add a custom item
                    </Button>
                  </div>
                ) : (
                  <ul>
                    {results.map((f) => (
                      <li key={f.key}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(f);
                            setQty(1);
                            setStyle("home");
                          }}
                          className="flex w-full items-center gap-3 rounded-orza-sm px-3 py-2.5 text-left transition-colors duration-150 ease-orza hover:bg-white/90 focus-visible:bg-white/90"
                        >
                          <DietMark diet={f.diet} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-orza-strong">{f.name}</span>
                            <span className="block truncate text-[12px] text-orza-muted">
                              {f.serving.label}
                              {f.category ? ` · ${f.category}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[12px] tabular-nums text-orza-muted">{formatNumber(f.per_serving.calories)} kcal</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "search" && selected && preview && (
          <div className="mt-4 space-y-4">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-orza-muted hover:text-orza-strong"
            >
              <ArrowLeft size={14} strokeWidth={1.75} aria-hidden /> Back to results
            </button>
            <div className="rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-1.5">
                  <DietMark diet={selected.diet} />
                </span>
                <div className="min-w-0">
                  <div className="font-editorial text-[20px] font-semibold leading-7 text-orza-strong">{selected.name}</div>
                  <div className="text-[13px] text-orza-muted">1 serving = {selected.serving.label}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-orza-strong">Servings</span>
                  <Stepper value={qty} onChange={setQty} max={maxQty} />
                </div>
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-orza-strong">Cooked</span>
                  <Segmented
                    size="sm"
                    value={style}
                    onChange={setStyle}
                    options={[
                      { value: "home", label: "At home" },
                      { value: "restaurant", label: "Restaurant" },
                    ]}
                  />
                </div>
              </div>
              <div className="mt-4">
                <NutrientGrid calories={preview.calories} protein={preview.protein} carbs={preview.carbs} fat={preview.fat} approx={preview.approx} />
              </div>
              <FieldHint className="mt-2.5">
                {style === "restaurant"
                  ? "Restaurant versions use more oil, butter and cream — ÖRZA adds that to the estimate when you log it."
                  : "Home-cooked estimate (e.g. home dal ≈ 5 ml oil per katori)."}
              </FieldHint>
              {qty >= maxQty && (
                <FieldHint className="mt-1.5">
                  One entry holds up to {fmtQty(maxQty)} servings of this — add more as another entry.
                </FieldHint>
              )}
            </div>
            <MealTypePicker value={mealType} onChange={setMealType} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={addFood} loading={saving}>
                Add {fmtQty(qty)} × {selected.name.length > 22 ? "item" : selected.name}
              </Button>
            </div>
          </div>
        )}

        {tab === "custom" && (
          <div className="mt-4 space-y-4">
            <ItemEditor rows={custom} onChange={setCustom} idPrefix="custom" showErrors={showErrors} addLabel="Add another" />
            <div className="flex items-center justify-between rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 px-3.5 py-2.5 text-[13px]">
              <span className="text-orza-muted">Total</span>
              <span className="font-mono tabular-nums text-orza-strong">
                {formatNumber(customTotals.calories)} kcal · P {customTotals.protein_g}g · C {customTotals.carbs_g}g · F {customTotals.fat_g}g
              </span>
            </div>
            <MealTypePicker value={mealType} onChange={setMealType} />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={addCustom} loading={saving} disabled={custom.length === 0}>
                Add to {MEAL_SINGULAR[mealType].toLowerCase()}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
