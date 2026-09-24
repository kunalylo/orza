"use client";
import * as React from "react";
import { BookmarkCheck, Clock, Flame } from "lucide-react";
import { Tag } from "@/components/orza/primitives";
import { cn, formatNumber } from "@/lib/utils";
import { displayTags, type RecipeItem } from "./types";

/**
 * Compact recipe card for the Saved / Recent grid. The warm wash scales with
 * calories per serving, echoing the ecosystem site's calendar load bars.
 */
export function RecipeTile({ recipe, onOpen }: { recipe: RecipeItem; onOpen: (r: RecipeItem) => void }) {
  const heat = Math.min(1, recipe.nutrition.calories / 800);
  const tags = displayTags(recipe.tags, 2);
  return (
    <button
      type="button"
      onClick={() => onOpen(recipe)}
      aria-label={`Open ${recipe.title}${recipe.saved ? " (saved)" : ""}`}
      className={cn(
        "group relative flex h-full w-full flex-col overflow-hidden rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.62)] p-5 text-left shadow-orza-glass backdrop-blur-orza",
        "transition-[background-color,box-shadow,transform] duration-220 ease-orza hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.78)] hover:shadow-orza-glass-hover"
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24"
        style={{ background: `linear-gradient(180deg, rgba(255,180,84,${0.05 + heat * 0.12}) 0%, rgba(255,95,162,0) 100%)` }}
      />
      <span className="relative flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-orza-subtle">{recipe.cuisine}</span>
        {recipe.saved && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#C2410C]">
            <BookmarkCheck size={13} strokeWidth={2} aria-hidden /> Saved
          </span>
        )}
      </span>
      <span className="relative mt-2 line-clamp-2 font-editorial text-[19px] font-semibold leading-[1.25] tracking-[-0.01em] text-orza-strong">
        {recipe.title}
      </span>
      {recipe.description && <span className="relative mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-orza-muted">{recipe.description}</span>}
      {tags.length > 0 && (
        <span className="relative mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Tag key={t.key} tone={t.tone} size="sm">
              {t.label}
            </Tag>
          ))}
        </span>
      )}
      <span aria-hidden className="min-h-4 flex-1" />
      <span className="relative flex items-center gap-4 border-t border-[rgba(20,20,20,0.07)] pt-3.5 text-[12.5px] text-orza-muted">
        <span className="inline-flex items-center gap-1.5">
          <Flame size={13} strokeWidth={1.9} className="text-[#E0593F]" aria-hidden />
          <span className="tabular-nums font-medium text-orza-strong">{formatNumber(recipe.nutrition.calories)}</span> kcal
        </span>
        <span className="tabular-nums">{recipe.nutrition.protein_g} g protein</span>
        <span className="ml-auto inline-flex items-center gap-1 tabular-nums">
          <Clock size={12.5} strokeWidth={1.9} aria-hidden /> {recipe.prep_minutes}m
        </span>
      </span>
    </button>
  );
}
