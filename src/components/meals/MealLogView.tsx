"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Camera, CircleAlert, RotateCw } from "lucide-react";
import type { Meal, MealType } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { addDays, dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { PageHeader } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { Reveal } from "@/components/orza/Reveal";
import { GlassCard } from "@/components/orza/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { DailySummary } from "./DailySummary";
import { DateNavigator } from "./DateNavigator";
import { EditMealDialog } from "./EditMealDialog";
import { FoodPickerDialog } from "./FoodPickerDialog";
import { LoggedResult } from "./LoggedResult";
import { MealComposer, type ComposerMealType } from "./MealComposer";
import { MealGroups } from "./MealGroups";
import { useAiStatus } from "./useAiStatus";
import {
  formatDayLabel,
  guessMealTypeClient,
  isMealType,
  isRealDay,
  sumNutrientsClient,
  type MealsResponse,
  type TextLogResponse,
} from "./meal-utils";

/** Suspense fallback for the page (useSearchParams). */
export function MealLogSkeleton() {
  return (
    <div aria-busy aria-label="Loading your meal log">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-[320px] w-full !rounded-orza-md" />
      <Skeleton className="mt-6 h-[180px] w-full !rounded-orza-md" />
    </div>
  );
}

/** /dashboard/meals — type or speak meals, add from the food list, and review/edit the day's log. */
export function MealLogView() {
  const { user } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const today = dateInTz(tz);
  const q = params.get("date");
  const date = isRealDay(q) && q < today ? q : today;
  const isToday = date === today;
  const dayLabel = formatDayLabel(date, today, addDays(today, -1));
  const qType = params.get("meal_type");

  const [composerType, setComposerType] = React.useState<ComposerMealType>(isMealType(qType) ? qType : "auto");
  React.useEffect(() => {
    if (isMealType(qType)) setComposerType(qType);
  }, [qType]);

  const [meals, setMeals] = React.useState<Meal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<TextLogResponse | null>(null);
  const [undoing, setUndoing] = React.useState(false);
  const [picker, setPicker] = React.useState<{ open: boolean; type: MealType; query?: string }>({ open: false, type: "lunch" });
  const [editing, setEditing] = React.useState<Meal | null>(null);
  const aiStatus = useAiStatus();
  const reqId = React.useRef(0);

  const load = React.useCallback(async (d: string, silent = false) => {
    const id = ++reqId.current;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get<MealsResponse>(`/meals?date=${d}`);
      if (id === reqId.current) setMeals(Array.isArray(res?.meals) ? res.meals : []);
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setResult(null);
    void load(date);
  }, [date, load]);

  // Keep the URL canonical: no ?date for today; invalid or future days fall back to today.
  React.useEffect(() => {
    const canonical = date === today ? null : date;
    if (q === canonical) return;
    const p = new URLSearchParams(params.toString());
    if (canonical) p.set("date", canonical);
    else p.delete("date");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [q, date, today, params, pathname, router]);

  const goTo = (d: string) => {
    const p = new URLSearchParams();
    if (d < today) p.set("date", d);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const totals = React.useMemo(() => sumNutrientsClient(meals.map((m) => m.totals)), [meals]);

  const upsert = React.useCallback(
    (m: Meal) =>
      setMeals((prev) => {
        if (m.date !== date) return prev.filter((x) => x.id !== m.id);
        const exists = prev.some((x) => x.id === m.id);
        const next = exists ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m];
        return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
      }),
    [date]
  );

  const onChanged = (m: Meal) => {
    upsert(m);
    setResult((r) => (r && r.meal.id === m.id ? { ...r, meal: m } : r));
  };

  const onDeleted = (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    setResult((r) => (r && r.meal.id === id ? null : r));
  };

  const onLogged = (res: TextLogResponse) => {
    upsert(res.meal);
    setResult(res);
  };

  const defaultType = (): MealType => (composerType !== "auto" ? composerType : guessMealTypeClient(tz));
  const openPicker = (type?: MealType, query?: string) => setPicker({ open: true, type: type ?? defaultType(), query });

  const undo = async () => {
    if (!result) return;
    setUndoing(true);
    try {
      await api.del(`/meals/${result.meal.id}`);
      onDeleted(result.meal.id);
      toast.success("Undone — that meal was removed");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUndoing(false);
    }
  };

  const scanHref = (() => {
    const p = new URLSearchParams();
    if (!isToday) p.set("date", date);
    if (composerType !== "auto") p.set("meal_type", composerType);
    const qs = p.toString();
    return `/dashboard/scan${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div>
      <PageHeader
        eyebrow="Meal log"
        title="What's on your plate?"
        description="Type or speak what you ate in English, Hindi or Hinglish — or pick from ÖRZA's food list. Manual logging is always free."
        actions={
          <>
            <DateNavigator date={date} today={today} onChange={goTo} />
            <ButtonLink href={scanHref} variant="secondary" size="sm" className="h-10">
              <Camera size={15} strokeWidth={1.75} aria-hidden /> Snap a meal
            </ButtonLink>
          </>
        }
      />

      <div className="space-y-6">
        {!isToday && (
          <div className="flex items-center gap-2 rounded-orza-sm border border-[rgba(135,87,242,0.22)] bg-[rgba(135,87,242,0.06)] px-3.5 py-2.5 text-[13px] text-[#5630A8]">
            <CalendarClock size={15} strokeWidth={1.75} className="shrink-0" aria-hidden />
            <span>
              You&apos;re logging for <strong className="font-semibold">{dayLabel}</strong>. New entries will be added to that day.
            </span>
          </div>
        )}

        <Reveal y={10}>
          <MealComposer
            date={date}
            mealType={composerType}
            onMealTypeChange={setComposerType}
            aiStatus={aiStatus}
            onLogged={onLogged}
            onOpenFoodList={() => openPicker()}
          />
        </Reveal>

        {result && (
          <LoggedResult
            key={result.meal.id}
            result={result}
            undoing={undoing}
            onDismiss={() => setResult(null)}
            onUndo={undo}
            onEdit={() => setEditing(result.meal)}
            onSearch={(phrase) => openPicker(result.meal.meal_type, phrase)}
          />
        )}

        {error && !loading ? (
          <GlassCard variant="strong" className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <CircleAlert size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#B02C2C]" aria-hidden />
              <div>
                <div className="text-[15px] font-medium text-orza-strong">We couldn&apos;t load your meals</div>
                <p className="mt-0.5 text-[13px] text-orza-muted">{error}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => load(date)}>
              <RotateCw size={14} strokeWidth={1.75} aria-hidden /> Try again
            </Button>
          </GlassCard>
        ) : (
          <>
            <Reveal delay={0.05} y={10}>
              <DailySummary totals={loading ? null : totals} targets={user.targets} dayLabel={dayLabel} loading={loading} />
            </Reveal>
            <div className="pt-4">
              <MealGroups
                meals={meals}
                loading={loading}
                dayLabel={dayLabel}
                scanHref={scanHref}
                tz={tz}
                onAdd={(type) => openPicker(type)}
                onChanged={onChanged}
                onDeleted={onDeleted}
                onEdit={setEditing}
              />
            </div>
          </>
        )}

        <p className="pt-2 text-center text-xs text-orza-subtle">
          Calorie estimates are approximate — home and restaurant versions of the same dish can differ a lot.
        </p>
      </div>

      <FoodPickerDialog
        open={picker.open}
        onOpenChange={(open) => setPicker((p) => ({ ...p, open }))}
        date={date}
        defaultMealType={picker.type}
        initialQuery={picker.query}
        onAdded={upsert}
      />
      <EditMealDialog meal={editing} onOpenChange={(open) => !open && setEditing(null)} onSaved={onChanged} />
    </div>
  );
}
