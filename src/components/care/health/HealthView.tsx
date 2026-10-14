"use client";
import * as React from "react";
import { Apple, BedDouble, Footprints, HeartPulse, RotateCw, Scale, Smartphone } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { addDays, dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { SITE } from "@/lib/site";
import { EmptyState, PageHeader, StatCard } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import { Segmented, Skeleton } from "@/components/ui/form";
import { AppleImportCard } from "./AppleImportCard";
import { CsvImportCard } from "./CsvImportCard";
import { AndroidSyncCard, IphoneAutoSyncCard, MobileAppNote, PrivacyNote } from "./ConnectGuides";
import { BarChart, ChartCard, LineChart, type ChartPoint } from "./HealthCharts";
import { SyncTokenCard } from "./SyncTokenCard";
import { formatDay, formatInt, formatKg, formatRelativeDay, formatSleep, sourceLabel, syncEndpoint, timeAgo } from "./format";
import type { HealthDaysResponse, HealthMetric, HealthTokenCreated, HealthTokenStatus, MergedHealthDay } from "./metrics";

type Range = "30" | "90";
type Platform = "iphone" | "android";

const DEFAULT_STEP_TARGET = 8000;
const SLEEP_GUIDE_MIN = 7 * 60;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "iphone";
  return /android/i.test(navigator.userAgent) ? "android" : "iphone";
}

/** Latest day in `days` with a value for `metric`. */
function latest(days: MergedHealthDay[], metric: HealthMetric): { date: string; value: number } | null {
  for (let i = days.length - 1; i >= 0; i--) {
    const v = days[i][metric];
    if (typeof v === "number") return { date: days[i].date, value: v };
  }
  return null;
}

function average(values: number[]) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function HealthSkeleton() {
  return (
    <div aria-busy aria-label="Loading your health data">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] !rounded-orza-md" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[290px] !rounded-orza-md" />
        ))}
      </div>
    </div>
  );
}

/** /dashboard/health — health data from Apple Health / Health Connect: charts, sources, and every way to connect. */
export function HealthView() {
  const { user } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const today = dateInTz(tz);
  const yesterday = addDays(today, -1);
  const stepTarget = user.targets?.steps > 0 ? user.targets.steps : DEFAULT_STEP_TARGET;
  const imperial = user.preferences?.units === "imperial";

  const [range, setRange] = React.useState<Range>("30");
  const [data, setData] = React.useState<HealthDaysResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = React.useState<HealthTokenStatus["token"]>(null);
  const [tokenLoading, setTokenLoading] = React.useState(true);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [freshToken, setFreshToken] = React.useState<string | null>(null);
  const [platform, setPlatform] = React.useState<Platform>("iphone");
  const [syncUrl, setSyncUrl] = React.useState(() => `${SITE.url.replace(/\/+$/, "")}/api/health/sync`);
  const reqId = React.useRef(0);

  React.useEffect(() => {
    setPlatform(detectPlatform());
    setSyncUrl(syncEndpoint(SITE.url));
  }, []);

  const from = addDays(today, -(Number(range) - 1));

  const load = React.useCallback(
    async (opts: { silent?: boolean } = {}) => {
      const id = ++reqId.current;
      if (opts.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await api.get<HealthDaysResponse>(`/health/days?from=${from}&to=${today}`);
        if (id === reqId.current) setData(res);
      } catch (e) {
        if (id === reqId.current) setError(errorMessage(e));
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [from, today]
  );

  // First load shows skeletons; switching range keeps the previous charts (dimmed) while fetching.
  const loadedOnce = React.useRef(false);
  React.useEffect(() => {
    void load({ silent: loadedOnce.current });
    loadedOnce.current = true;
  }, [load]);

  // Coming back from the phone's automation app: pick up anything that arrived meanwhile.
  const lastLoad = React.useRef(0);
  React.useEffect(() => {
    lastLoad.current = Date.now();
  }, [data]);
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoad.current > 30_000) void load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const tokenAlive = React.useRef(true);
  const loadToken = React.useCallback(async () => {
    setTokenLoading(true);
    setTokenError(null);
    try {
      const r = await api.get<HealthTokenStatus>("/health/token");
      if (tokenAlive.current) setTokenStatus(r.token);
    } catch (e) {
      if (tokenAlive.current) setTokenError(errorMessage(e));
    } finally {
      if (tokenAlive.current) setTokenLoading(false);
    }
  }, []);
  React.useEffect(() => {
    tokenAlive.current = true;
    void loadToken();
    return () => {
      tokenAlive.current = false;
    };
  }, [loadToken]);

  const days = data?.days ?? [];
  const byDate = React.useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const dates = React.useMemo(() => Array.from({ length: Number(range) }, (_, i) => addDays(from, i)), [from, range]);
  const series = React.useCallback(
    (metric: HealthMetric, map: (v: number) => number = (v) => v): ChartPoint[] =>
      dates.map((date) => {
        const v = byDate.get(date)?.[metric];
        return { date, value: typeof v === "number" ? map(v) : undefined };
      }),
    [dates, byDate]
  );

  const steps = series("steps");
  const sleepHours = series("sleep_minutes", (m) => m / 60);
  const resting = series("resting_hr");
  const weight = series("weight_kg");
  const has = (pts: ChartPoint[]) => pts.some((p) => p.value !== undefined);

  const stepVals = steps.flatMap((p) => (p.value !== undefined ? [p.value] : []));
  const sleepVals = days.flatMap((d) => (typeof d.sleep_minutes === "number" ? [d.sleep_minutes] : []));
  const restingVals = resting.flatMap((p) => (p.value !== undefined ? [p.value] : []));
  const weightPts = weight.filter((p) => p.value !== undefined) as Array<{ date: string; value: number }>;
  const onTarget = stepVals.filter((v) => v >= stepTarget).length;

  const latestSteps = latest(days, "steps");
  const latestSleep = latest(days, "sleep_minutes");
  const latestResting = latest(days, "resting_hr");
  const latestWeight = latest(days, "weight_kg");
  const rel = (d: string) => formatRelativeDay(d, today, yesterday);

  const noData = !loading && !error && data && days.length === 0;
  const neverSynced = noData && !data?.last_sync;
  const onImported = () => void load({ silent: true });
  const isIphone = platform === "iphone";

  const tokenCard = (
    <SyncTokenCard
      status={tokenStatus}
      loading={tokenLoading}
      error={tokenError}
      onRetry={() => void loadToken()}
      freshToken={freshToken}
      syncUrl={syncUrl}
      onCreated={(c: HealthTokenCreated) => {
        setFreshToken(c.token);
        setTokenError(null);
        setTokenStatus({ preview: c.preview, created_at: c.created_at });
      }}
      onRevoked={() => {
        setFreshToken(null);
        setTokenError(null);
        setTokenStatus(null);
      }}
      onDismissFresh={() => setFreshToken(null)}
    />
  );

  const connect = (
    <section id="connect" aria-labelledby="connect-title" className="scroll-mt-24">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Connect</Eyebrow>
          <h2 id="connect-title" className="mt-1.5 font-editorial text-[24px] font-semibold leading-8 text-orza-strong">
            Bring in your phone&apos;s health data
          </h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-orza-muted">
            A website can&apos;t read Apple Health or Health Connect directly, so pick whichever of these suits you. You can use more than one.
          </p>
        </div>
        <Segmented semantics="tabs" id="health-platform" panelId="health-platform-panel" aria-label="Your phone"
          value={platform}
          onChange={setPlatform}
          options={[
            {
              value: "iphone",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Apple className="h-3.5 w-3.5" aria-hidden />
                  iPhone
                </span>
              ),
            },
            {
              value: "android",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden />
                  Android
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Every card stays mounted (an Apple Health import keeps running if you peek at the Android tab); the other platform's cards are hidden. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" role="tabpanel" id="health-platform-panel" aria-labelledby={`health-platform-${platform}`}>
        <div className={cn("grid min-w-0 grid-cols-1", !isIphone && "hidden")}>
          <AppleImportCard tz={tz} onImported={onImported} />
        </div>
        <div className={cn("grid min-w-0 grid-cols-1", !isIphone && "hidden")}>
          <IphoneAutoSyncCard syncUrl={syncUrl} token={freshToken} hasToken={!!tokenStatus} today={today} />
        </div>
        <div className={cn("grid min-w-0 grid-cols-1", isIphone && "hidden")}>
          <AndroidSyncCard syncUrl={syncUrl} token={freshToken} hasToken={!!tokenStatus} today={today} />
        </div>
        <div className="grid min-w-0 grid-cols-1">{tokenCard}</div>
        <div className={cn("grid min-w-0 grid-cols-1", !isIphone && "lg:col-span-2")}>
          <CsvImportCard tz={tz} imperial={imperial} onImported={onImported} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <PrivacyNote />
        <MobileAppNote />
      </div>
    </section>
  );

  if (loading && !data) return <HealthSkeleton />;

  return (
    <div>
      <PageHeader
        eyebrow="Care · Health sync"
        title="Health sync"
        description="Steps, sleep, heart rate and weight from Apple Health and Android Health Connect, side by side with what you eat."
        actions={
          <div className="flex items-center gap-2">
            {data?.last_sync && (
              <Tag tone="success">
                Synced {timeAgo(data.last_sync)}
                {data.last_sync_source ? ` · ${sourceLabel(data.last_sync_source)}` : ""}
              </Tag>
            )}
            <Button size="icon" variant="ghost" aria-label="Check for new health data" onClick={() => void load({ silent: true })} disabled={refreshing}>
              <RotateCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
            </Button>
          </div>
        }
      />

      {error && !data ? (
        <EmptyState
          icon={<HeartPulse className="h-5 w-5" aria-hidden />}
          title="We couldn't load your health data"
          description={error}
          action={
            <Button onClick={() => void load()}>
              <RotateCw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          }
        />
      ) : neverSynced ? (
        <EmptyState
          icon={<HeartPulse className="h-5 w-5" aria-hidden />}
          title="No health data yet"
          description="Import your Apple Health export, connect an automation app, or upload a CSV — your steps, sleep, heart rate and weight will show up here."
          action={
            <a href="#connect" className={buttonVariants()}>
              See ways to connect
            </a>
          }
          className="mb-10"
        />
      ) : (
        <>
          {error && (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-orza-sm border border-[rgba(176,44,44,0.22)] bg-[#FDECEC] px-4 py-3 text-[13.5px] text-[#8F2323]">
              {error}
              <Button size="sm" variant="secondary" onClick={() => void load({ silent: true })}>
                Try again
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Steps"
              icon={<Footprints className="h-4 w-4" aria-hidden />}
              value={latestSteps ? formatInt(latestSteps.value) : "—"}
              hint={latestSteps ? `${rel(latestSteps.date)} · target ${formatInt(stepTarget)}` : "No steps in this period"}
            />
            <StatCard
              label="Sleep"
              icon={<BedDouble className="h-4 w-4" aria-hidden />}
              value={latestSleep ? formatSleep(latestSleep.value) : "—"}
              hint={
                latestSleep
                  ? `Woke up ${latestSleep.date === today ? "today" : latestSleep.date === yesterday ? "yesterday" : rel(latestSleep.date)}`
                  : "No sleep in this period"
              }
            />
            <StatCard
              label="Resting HR"
              icon={<HeartPulse className="h-4 w-4" aria-hidden />}
              value={latestResting ? latestResting.value : "—"}
              unit={latestResting ? "bpm" : undefined}
              hint={latestResting ? rel(latestResting.date) : "No readings in this period"}
            />
            <StatCard
              label="Weight"
              icon={<Scale className="h-4 w-4" aria-hidden />}
              value={latestWeight ? formatKg(latestWeight.value) : "—"}
              unit={latestWeight ? "kg" : undefined}
              hint={latestWeight ? rel(latestWeight.date) : "No weigh-ins in this period"}
            />
          </div>

          <div className="mb-4 mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-editorial text-[22px] font-semibold leading-7 text-orza-strong">Trends</h2>
            <Segmented aria-label="Trend period"
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: "30", label: "30 days" },
                { value: "90", label: "90 days" },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard
              title="Steps"
              subtitle={`Daily steps vs your ${formatInt(stepTarget)} target`}
              headline={stepVals.length ? formatInt(average(stepVals)) : undefined}
              headlineNote={stepVals.length ? `avg · ${onTarget} of ${stepVals.length} days on target` : undefined}
              empty={!has(steps)}
              emptyText="No steps in this period."
              dimmed={refreshing}
            >
              <BarChart
                points={steps}
                tone="energy"
                format={(v) => `${formatInt(v)} steps`}
                label={`Daily steps, last ${range} days`}
                reference={{ value: stepTarget, label: `Target ${formatInt(stepTarget)}` }}
                unitNote={(v) => (v >= stepTarget ? "Target reached" : `${formatInt(stepTarget - v)} short of target`)}
              />
            </ChartCard>
            <ChartCard
              title="Sleep"
              subtitle="Hours asleep, credited to the morning you woke up"
              headline={sleepVals.length ? formatSleep(average(sleepVals)) : undefined}
              headlineNote={sleepVals.length ? `avg over ${sleepVals.length} nights` : undefined}
              empty={!has(sleepHours)}
              emptyText="No sleep in this period."
              dimmed={refreshing}
            >
              <BarChart
                points={sleepHours}
                tone="violet"
                format={(v) => formatSleep(v * 60)}
                label={`Hours of sleep, last ${range} days`}
                reference={{ value: SLEEP_GUIDE_MIN / 60, label: "7 h" }}
              />
            </ChartCard>
            <ChartCard
              title="Resting heart rate"
              subtitle="Beats per minute at rest"
              headline={restingVals.length ? `${Math.round(average(restingVals))} bpm` : undefined}
              headlineNote={restingVals.length ? "average" : undefined}
              empty={!has(resting)}
              emptyText="No resting heart rate in this period. It usually comes from a watch or fitness band."
              dimmed={refreshing}
            >
              <LineChart points={resting} tone="coral" format={(v) => `${v} bpm`} label={`Resting heart rate, last ${range} days`} minSpan={6} />
            </ChartCard>
            <ChartCard
              title="Weight"
              subtitle="Latest reading each day, in kg"
              headline={weightPts.length ? `${formatKg(weightPts[weightPts.length - 1].value)} kg` : undefined}
              headlineNote={
                weightPts.length > 1
                  ? `${weightPts[weightPts.length - 1].value - weightPts[0].value >= 0 ? "+" : "−"}${formatKg(Math.abs(weightPts[weightPts.length - 1].value - weightPts[0].value))} kg since ${formatDay(weightPts[0].date)}`
                  : undefined
              }
              empty={!has(weight)}
              emptyText="No weigh-ins in this period."
              dimmed={refreshing}
            >
              <LineChart points={weight} tone="cyan" format={(v) => `${formatKg(v)} kg`} label={`Weight, last ${range} days`} minSpan={2} />
            </ChartCard>
          </div>

          {data && (
            <GlassCard className="mt-4" padded={false}>
              <div className="flex flex-col gap-1 px-5 pt-5 sm:flex-row sm:items-baseline sm:justify-between sm:px-6">
                <h3 className="font-editorial text-[18px] font-semibold text-orza-strong">Sources</h3>
                <p className="text-[12.5px] text-orza-muted">
                  {data.last_sync ? `Last data received ${timeAgo(data.last_sync)}` : "Nothing received yet"} · where sources overlap, ÖRZA keeps the
                  higher daily total
                </p>
              </div>
              {data.sources.length ? (
                <ul className="mt-3 divide-y divide-[rgba(20,20,20,0.07)] border-t border-[rgba(20,20,20,0.07)]">
                  {data.sources.map((s) => (
                    <li key={s.source} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 sm:px-6">
                      <span className="text-[14px] font-medium text-orza-strong">{s.label}</span>
                      <span className="text-[12.5px] tabular-nums text-orza-muted">
                        {s.days} {s.days === 1 ? "day" : "days"} in view · {formatDay(s.first_date)} – {formatDay(s.last_date)} · updated {timeAgo(s.last_updated)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 pt-2 text-[13px] text-orza-muted sm:px-6">No data from any source in the last {range} days.</p>
              )}
              {data.sources.length > 0 && <div className="h-2" />}
            </GlassCard>
          )}
        </>
      )}

      <div className="mt-12">{connect}</div>
    </div>
  );
}
