"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, RotateCw } from "lucide-react";
import { useUser } from "@/components/app/UserProvider";
import { Reveal } from "@/components/orza/Reveal";
import { GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { EnergyCard } from "@/components/today/EnergyCard";
import { InsightCard } from "@/components/today/InsightCard";
import { MealsSection } from "@/components/today/MealsSection";
import { QuickActions } from "@/components/today/QuickActions";
import { StepsCard } from "@/components/today/StepsCard";
import { TodayHeader } from "@/components/today/TodayHeader";
import { TodaySkeleton } from "@/components/today/TodaySkeleton";
import { WaterCard } from "@/components/today/WaterCard";
import { WeekStrip } from "@/components/today/WeekStrip";
import { WeightCard } from "@/components/today/WeightCard";
import { firstName, isRealDay } from "@/components/today/format";
import type { TodayData } from "@/components/today/types";
import { api, errorMessage } from "@/lib/api-client";
import { dateInTz, DEFAULT_TZ, hourInTz } from "@/lib/dates";
import type { PublicUser, TrackingDay } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TodayView() {
  const { user, setUser } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("date");
  const requested = isRealDay(q) ? q : null; // null → the user's today

  const [data, setData] = React.useState<TodayData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const reqId = React.useRef(0);
  const dataRef = React.useRef<TodayData | null>(null);
  React.useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const today = data?.today ?? dateInTz(tz);
  const viewDate = requested && requested < today ? requested : today;

  const load = React.useCallback(
    async (date: string | null) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<TodayData>(`/dashboard/today${date ? `?date=${date}` : ""}`);
        if (id !== reqId.current) return;
        setData(res);
        // Keep the URL canonical: no ?date for today (or when the server clamped a future day).
        // Checked against *this* response only, so browsing between past days never bounces to today.
        if (date && (res.date !== date || res.date === res.today)) router.replace(pathname, { scroll: false });
      } catch (e) {
        if (id === reqId.current) setError(errorMessage(e));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [pathname, router]
  );

  React.useEffect(() => {
    load(requested);
  }, [requested, load]);

  const goTo = React.useCallback(
    (date: string) => {
      const t = dataRef.current?.today ?? dateInTz(tz);
      router.replace(date >= t ? pathname : `${pathname}?date=${date}`, { scroll: false });
    },
    [pathname, router, tz]
  );

  /* ─── background refreshes after tracking changes (insight / streak / week) ─── */
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const softRefresh = React.useCallback(async (withTracking: boolean) => {
    const current = dataRef.current;
    if (!current) return;
    try {
      const res = await api.get<TodayData>(`/dashboard/today?date=${current.date}`);
      setData((d) =>
        d && d.date === res.date
          ? {
              ...d,
              insight: res.insight,
              streak: res.streak,
              week: res.week,
              last_weight: res.last_weight,
              ...(withTracking ? { tracking: res.tracking } : {}),
            }
          : d
      );
    } catch {
      /* non-critical: the visible numbers are already up to date */
    }
  }, []);
  const scheduleRefresh = React.useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => softRefresh(false), 900);
  }, [softRefresh]);
  React.useEffect(() => () => clearTimeout(refreshTimer.current), []);

  const mergeTracking = React.useCallback(
    (t: TrackingDay) => {
      setData((d) => {
        if (!d || d.date !== t.date) return d;
        const next: TodayData = { ...d, tracking: { ...d.tracking, ...t } };
        if (t.weight_kg != null) next.last_weight = { weight_kg: t.weight_kg, date: t.date };
        return next;
      });
      scheduleRefresh();
    },
    [scheduleRefresh]
  );

  const onWeightSaved = React.useCallback(
    (t: TrackingDay, u?: PublicUser) => {
      mergeTracking(t);
      if (u) setUser(u);
    },
    [mergeTracking, setUser]
  );

  const name = firstName(user.name, user.email);
  const stale = loading && !!data && data.date !== viewDate;
  const imperial = user.preferences?.units === "imperial";

  return (
    <div>
      <TodayHeader
        name={name}
        date={viewDate}
        today={today}
        hour={hourInTz(tz)}
        streak={data ? data.streak : null}
        busy={loading && !!data}
        onDateChange={goTo}
      />

      {error ? (
        <GlassCard variant="strong" className="flex flex-col items-center px-6 py-12 text-center" role="alert">
          <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#FDECEC] text-[#B02C2C]">
            <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
          </span>
          <div className="font-editorial text-lg font-semibold text-orza-strong">We couldn&rsquo;t load your day</div>
          <p className="mt-1.5 max-w-sm text-sm text-orza-muted">{error}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="primary" onClick={() => load(requested)}>
              <RotateCw size={15} strokeWidth={1.75} aria-hidden /> Try again
            </Button>
            {requested && (
              <Button variant="secondary" onClick={() => goTo(today)}>
                Back to today
              </Button>
            )}
          </div>
        </GlassCard>
      ) : !data ? (
        <TodaySkeleton />
      ) : (
        <div className={cn("transition-opacity duration-220 ease-orza", stale && "opacity-60")} aria-busy={loading}>
          <Reveal y={10}>
            <WeekStrip week={data.week} date={data.date} today={data.today} target={data.targets.calories} onSelect={goTo} />
          </Reveal>

          <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-[1.45fr_1fr] lg:gap-6">
            <Reveal delay={0.05} className="h-full">
              <EnergyCard totals={data.totals} targets={data.targets} remaining={data.remaining} isToday={data.date === data.today} />
            </Reveal>
            <div className="flex flex-col gap-4">
              <Reveal delay={0.1}>
                <InsightCard insight={data.insight} />
              </Reveal>
              <Reveal delay={0.15}>
                <QuickActions date={data.date === data.today ? undefined : data.date} />
              </Reveal>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:mt-6 lg:grid-cols-3 lg:gap-6">
            <Reveal delay={0.05} className="h-full">
              <WaterCard
                key={`water-${data.date}`}
                date={data.date}
                glasses={data.tracking.water_glasses || 0}
                target={data.targets.water_glasses}
                onSaved={mergeTracking}
                onResync={() => softRefresh(true)}
              />
            </Reveal>
            <Reveal delay={0.1} className="h-full">
              <StepsCard
                key={`steps-${data.date}`}
                date={data.date}
                isToday={data.date === data.today}
                steps={data.tracking.steps || 0}
                target={data.targets.steps}
                onSaved={mergeTracking}
              />
            </Reveal>
            <Reveal delay={0.15} className="h-full sm:col-span-2 lg:col-span-1">
              <WeightCard
                key={`weight-${data.date}`}
                date={data.date}
                today={data.today}
                dayWeight={data.tracking.weight_kg}
                lastWeight={data.last_weight}
                profileWeight={user.profile?.weight_kg}
                goal={data.goal}
                imperial={imperial}
                onSaved={onWeightSaved}
              />
            </Reveal>
          </div>

          <MealsSection
            className="mt-10 lg:mt-12"
            meals={data.meals}
            totals={data.totals}
            date={data.date}
            isToday={data.date === data.today}
            tz={tz}
          />
        </div>
      )}
    </div>
  );
}
