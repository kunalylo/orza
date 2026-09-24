import * as React from "react";
import Link from "next/link";
import { Camera, Coffee, Cookie, Keyboard, MessageCircle, Mic, Moon, PenLine, Plus, Sun, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Eyebrow, GlassCard, IconTile } from "@/components/orza/primitives";
import { EmptyState } from "@/components/app/ui";
import { ButtonLink } from "@/components/ui/button";
import { sumMealTotals } from "./totals";
import type { Meal, MealSource, MealType, Nutrients } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";
import { timeInTz } from "./format";
import { MEAL_LABEL, MEAL_ORDER } from "./types";

const MEAL_ICON: Record<MealType, LucideIcon> = { breakfast: Coffee, lunch: Sun, snack: Cookie, dinner: Moon };
const MEAL_TONE: Record<MealType, "energy" | "cyan" | "violet" | "neutral"> = {
  breakfast: "energy",
  lunch: "cyan",
  snack: "neutral",
  dinner: "violet",
};
const SOURCE: Record<MealSource, { icon: LucideIcon; label: string }> = {
  photo: { icon: Camera, label: "Logged from a photo" },
  text: { icon: Keyboard, label: "Typed" },
  voice: { icon: Mic, label: "Spoken" },
  manual: { icon: PenLine, label: "Added manually" },
  chat: { icon: MessageCircle, label: "Logged in chat" },
};

/** Meals for the day grouped by meal type, with per-group totals and "Log" links. */
export function MealsSection({
  meals,
  totals,
  date,
  isToday,
  tz,
  className,
}: {
  meals: Meal[];
  totals: Nutrients;
  date: string;
  isToday: boolean;
  tz?: string;
  className?: string;
}) {
  const logHref = (type?: MealType) => {
    const p = new URLSearchParams();
    if (!isToday) p.set("date", date);
    if (type) p.set("meal_type", type);
    const qs = p.toString();
    return `/dashboard/meals${qs ? `?${qs}` : ""}`;
  };

  return (
    <section aria-labelledby="today-meals-heading" className={className}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>On your plate</Eyebrow>
          <h2 id="today-meals-heading" className="mt-2 font-editorial text-[26px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[30px]">
            {isToday ? "Today's meals" : "Meals that day"}
          </h2>
        </div>
        {meals.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-orza-muted">
              <span className="font-medium tabular-nums text-orza-strong">{formatNumber(totals.calories)}</span> kcal ·{" "}
              {meals.length} {meals.length === 1 ? "entry" : "entries"}
            </span>
            <ButtonLink href={logHref()} variant="secondary" size="sm">
              <Plus size={14} strokeWidth={2} aria-hidden /> Log a meal
            </ButtonLink>
          </div>
        )}
      </div>

      {meals.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed size={20} strokeWidth={1.75} />}
          title={isToday ? "Nothing on your plate yet" : "Nothing was logged this day"}
          description={
            isToday
              ? "Snap a photo, type it, or just tell ÖRZA what you ate — in English, Hindi or Hinglish."
              : "Forgot to log? You can still add meals for this day — ÖRZA will update your totals."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/dashboard/scan${isToday ? "" : `?date=${date}`}`} variant="primary" size="md">
                <Camera size={15} strokeWidth={1.75} aria-hidden /> Snap a meal
              </ButtonLink>
              <ButtonLink href={logHref()} variant="secondary" size="md">
                <Mic size={15} strokeWidth={1.75} aria-hidden /> Type or speak
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {MEAL_ORDER.map((type) => (
            <MealGroup key={type} type={type} meals={meals.filter((m) => m.meal_type === type)} href={logHref(type)} tz={tz} />
          ))}
        </div>
      )}
    </section>
  );
}

function MealGroup({ type, meals, href, tz }: { type: MealType; meals: Meal[]; href: string; tz?: string }) {
  const Icon = MEAL_ICON[type];
  const label = MEAL_LABEL[type];
  const t = sumMealTotals(meals);
  const empty = meals.length === 0;

  return (
    <GlassCard variant={empty ? "subtle" : "base"} padded={false} className="flex flex-col p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconTile tone={MEAL_TONE[type]} className="h-9 w-9">
            <Icon size={16} strokeWidth={1.75} aria-hidden />
          </IconTile>
          <div className="min-w-0">
            <h3 className="font-editorial text-[18px] font-semibold leading-tight text-orza-strong">{label}</h3>
            <p className="text-xs text-orza-muted">
              {empty ? "Nothing logged yet" : `${formatNumber(t.calories)} kcal · ${meals.length} ${meals.length === 1 ? "entry" : "entries"}`}
            </p>
          </div>
        </div>
        <Link
          href={href}
          aria-label={`Log ${label.toLowerCase()}`}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[rgba(20,20,20,0.12)] bg-white/70 px-3 text-[12.5px] font-medium text-orza-strong transition-colors duration-150 ease-orza hover:bg-white"
        >
          <Plus size={13} strokeWidth={2} aria-hidden /> Log
        </Link>
      </div>

      {!empty && (
        <>
          <ul className="mt-3 divide-y divide-[rgba(20,20,20,0.07)]">
            {meals.map((m) => (
              <MealRow key={m.id} meal={m} tz={tz} />
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-[rgba(20,20,20,0.07)] pt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-orza-subtle">
            <span>
              Protein <span className="tabular-nums text-orza-muted">{formatNumber(t.protein_g)} g</span>
            </span>
            <span>
              Carbs <span className="tabular-nums text-orza-muted">{formatNumber(t.carbs_g)} g</span>
            </span>
            <span>
              Fat <span className="tabular-nums text-orza-muted">{formatNumber(t.fat_g)} g</span>
            </span>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function MealRow({ meal, tz }: { meal: Meal; tz?: string }) {
  const src = SOURCE[meal.source] || SOURCE.manual;
  const SrcIcon = src.icon;
  const items = (meal.items || []).map((i) => (i.quantity && i.quantity !== 1 ? `${i.name} ×${formatQty(i.quantity)}` : i.name));
  const title = meal.description?.trim() || items.join(", ") || "Meal";
  const subtitle = meal.description?.trim() ? items.join(", ") : "";
  const time = timeInTz(meal.created_at, tz);

  return (
    <li className="flex items-start gap-3 py-3 first:pt-2">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-orza-subtle" title={src.label}>
        <SrcIcon size={12} strokeWidth={1.75} aria-hidden />
        <span className="sr-only">{src.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] leading-snug text-orza-strong first-letter:uppercase">{title}</p>
        {(subtitle || time) && (
          <p className={cn("mt-0.5 truncate text-xs text-orza-muted")}>
            {time}
            {time && subtitle ? " · " : ""}
            {subtitle}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[14px] font-medium tabular-nums text-orza-strong">{formatNumber(meal.totals?.calories || 0)}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-orza-subtle">kcal</div>
      </div>
    </li>
  );
}

const formatQty = (q: number) => (Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100));
