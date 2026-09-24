"use client";
import * as React from "react";
import { Bookmark, BookmarkCheck, Check, Clock, Plus, Trash2, Users } from "lucide-react";
import { Eyebrow, Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { WellnessNote } from "@/components/app/ui";
import { cn, formatNumber } from "@/lib/utils";
import { displayTags, type RecipeItem } from "./types";

/** Per-serving nutrition strip: calories lead, macros follow. */
export function NutritionRow({ nutrition, className }: { nutrition: RecipeItem["nutrition"]; className?: string }) {
  const cells = [
    { label: "Calories", short: "Kcal", value: formatNumber(nutrition.calories), unit: "kcal" },
    { label: "Protein", value: nutrition.protein_g, unit: "g" },
    { label: "Carbs", value: nutrition.carbs_g, unit: "g" },
    { label: "Fat", value: nutrition.fat_g, unit: "g" },
    { label: "Fibre", value: nutrition.fiber_g, unit: "g" },
  ];
  return (
    <div className={cn("overflow-hidden rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/55", className)}>
      <div className="border-b border-[rgba(20,20,20,0.06)] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Per serving</span>
      </div>
      <dl className="grid grid-cols-5 divide-x divide-[rgba(20,20,20,0.06)]">
        {cells.map((c, i) => (
          <div key={c.label} className={cn("min-w-0 px-1 py-2.5 text-center sm:px-3", i === 0 && "bg-[linear-gradient(180deg,rgba(255,180,84,0.14),rgba(255,95,162,0.06))]")}>
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-orza-subtle sm:text-[10px] sm:tracking-[0.12em]">
              {c.short ? (
                <>
                  <span className="sm:hidden">{c.short}</span>
                  <span className="hidden sm:inline">{c.label}</span>
                </>
              ) : (
                c.label
              )}
            </dt>
            <dd className="mt-1 flex items-baseline justify-center gap-0.5">
              <span className="font-editorial text-[17px] font-semibold leading-none tabular-nums text-orza-strong sm:text-[20px]">{c.value}</span>
              <span className={cn("text-[10px] text-orza-subtle sm:text-[11px]", c.short && "hidden sm:inline")}>{c.unit}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Full recipe: title, tags, nutrition, ingredient checklist and numbered steps.
 * `layout="wide"` puts ingredients and steps side by side on large screens (result card);
 * `layout="stacked"` is for the dialog.
 */
export function RecipeDetail({
  recipe,
  layout = "wide",
  headingLevel = "h2",
  onToggleSave,
  saving,
  onLog,
  logging,
  onDelete,
  deleting,
  aside,
  notice,
}: {
  recipe: RecipeItem;
  layout?: "wide" | "stacked";
  headingLevel?: "h2" | "h3";
  onToggleSave?: () => void;
  saving?: boolean;
  onLog?: () => void;
  logging?: boolean;
  onDelete?: () => void;
  deleting?: boolean;
  /** Rendered at the right of the eyebrow row (e.g. close / regenerate buttons). */
  aside?: React.ReactNode;
  /** Context shown under the description (e.g. why a curated recipe was picked). */
  notice?: React.ReactNode;
}) {
  const [checked, setChecked] = React.useState<Set<number>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const idBase = React.useId();
  const Title = headingLevel;
  const Sub = headingLevel === "h2" ? "h3" : "h4";
  const tags = displayTags(recipe.tags);

  React.useEffect(() => {
    setChecked(new Set());
    setConfirmDelete(false);
  }, [recipe.id]);

  const toggle = (i: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <Eyebrow>{recipe.source === "ai" ? "Created by ÖRZA AI" : "From ÖRZA's recipe collection"}</Eyebrow>
        {aside}
      </div>
      <Title className="mt-1 font-editorial text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-orza-strong sm:text-[32px]">
        {recipe.title}
      </Title>
      {recipe.description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-orza-muted">{recipe.description}</p>}
      {notice}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Tag tone="violet">{recipe.cuisine}</Tag>
        <Tag tone="neutral" dot={false}>
          <Clock size={12} strokeWidth={2} aria-hidden /> {recipe.prep_minutes} min
        </Tag>
        <Tag tone="neutral" dot={false}>
          <Users size={12} strokeWidth={2} aria-hidden /> Serves {recipe.servings}
        </Tag>
        {tags.map((t) => (
          <Tag key={t.key} tone={t.tone}>
            {t.label}
          </Tag>
        ))}
      </div>

      <NutritionRow nutrition={recipe.nutrition} className="mt-5" />

      <div className={cn("mt-6 grid gap-6", layout === "wide" && "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8")}>
        <section aria-labelledby={`${idBase}-ing`}>
          <div className="flex items-baseline justify-between gap-3">
            <Sub id={`${idBase}-ing`} className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
              Ingredients
            </Sub>
            <span className="text-xs tabular-nums text-orza-subtle" aria-live="polite">
              {checked.size}/{recipe.ingredients.length} ready
            </span>
          </div>
          <ul className="mt-3 space-y-1">
            {recipe.ingredients.map((ing, i) => {
              const id = `${idBase}-i${i}`;
              const on = checked.has(i);
              return (
                <li key={i}>
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-orza-xs px-2 py-1.5 text-[14.5px] leading-snug transition-colors duration-150 ease-orza hover:bg-white/70",
                      on ? "text-orza-subtle" : "text-orza-strong"
                    )}
                  >
                    <input id={id} type="checkbox" checked={on} onChange={() => toggle(i)} className="peer sr-only" />
                    <span
                      aria-hidden
                      className={cn(
                        "mt-[1px] inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-150 ease-orza",
                        "peer-focus-visible:shadow-[0_0_0_3px_rgba(11,190,220,0.25)]",
                        on ? "border-transparent bg-orza-energy text-white" : "border-[rgba(20,20,20,0.22)] bg-white"
                      )}
                    >
                      {on && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className={cn(on && "line-through decoration-[rgba(20,20,20,0.35)]")}>{ing}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby={`${idBase}-steps`}>
          <Sub id={`${idBase}-steps`} className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
            Method
          </Sub>
          <ol className="mt-3 space-y-3.5">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3.5">
                <span
                  aria-hidden
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(255,122,106,0.28)] bg-[#FFF1EA] font-mono text-[12px] font-medium text-[#C2410C]"
                >
                  {i + 1}
                </span>
                <p className="pt-[3px] text-[14.5px] leading-relaxed text-orza-strong">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {(onToggleSave || onLog || onDelete) && (
        <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-[rgba(20,20,20,0.08)] pt-5">
          {onToggleSave && (
            <Button variant={recipe.saved ? "secondary" : "primary"} onClick={onToggleSave} loading={saving} aria-pressed={recipe.saved}>
              {!saving && (recipe.saved ? <BookmarkCheck size={16} strokeWidth={1.9} aria-hidden /> : <Bookmark size={16} strokeWidth={1.9} aria-hidden />)}
              {recipe.saved ? "Saved" : "Save recipe"}
            </Button>
          )}
          {onLog && (
            <Button variant="secondary" onClick={onLog} loading={logging}>
              {!logging && <Plus size={16} strokeWidth={1.9} aria-hidden />}
              Log 1 serving
            </Button>
          )}
          {onDelete &&
            (confirmDelete ? (
              <span className="ml-auto flex items-center gap-2">
                <span className="text-[13px] text-orza-muted">Delete this recipe?</span>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  Keep
                </Button>
                <Button variant="danger" size="sm" onClick={onDelete} loading={deleting}>
                  Delete
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="ml-auto" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} strokeWidth={1.9} aria-hidden /> Delete
              </Button>
            ))}
        </div>
      )}
      <WellnessNote className="mt-4" />
    </div>
  );
}
