"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, CircleAlert, RotateCw } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { addDays, dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { GlassCard } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { ConnectCard } from "./ConnectCard";
import { DayAgenda } from "./DayAgenda";
import { MonthGrid } from "./MonthGrid";
import { SubscribeCard } from "./SubscribeCard";
import { WeekView } from "./WeekView";
import {
  KIND_COLOR,
  KIND_LABEL,
  type CalendarEventsResponse,
  type CalendarFeedLinks,
  type CalendarStatusResponse,
  type ExternalCalendarState,
} from "./types";
import { formatMonth, formatWeekRange, groupByDate, KIND_ORDER, monthGridDates, monthOf, shiftMonth, weekDates } from "./utils";

type View = "month" | "week";
type CacheEntry = { at: number; res: CalendarEventsResponse };

const VIEW_KEY = "orza.calendar.view";
/** Cached ranges older than this are shown immediately and refreshed in the background. */
const STALE_MS = 60_000;

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "week" ? "week" : "month";
  } catch {
    return "month";
  }
}

/** /dashboard/calendar — month/week calendar of doses, reminders, meals and the user's own calendar. */
export function CalendarView() {
  const { user } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;

  const [today, setToday] = React.useState(() => dateInTz(tz));
  const [selected, setSelected] = React.useState(today);
  const [view, setViewState] = React.useState<View>("month");

  React.useEffect(() => setViewState(readView()), []);
  const setView = (v: View) => {
    setViewState(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode — the choice just isn't remembered */
    }
  };

  // Keep "today" right across midnight while the page stays open.
  React.useEffect(() => {
    const t = setInterval(() => setToday(dateInTz(tz)), 60_000);
    return () => clearInterval(t);
  }, [tz]);

  const month = monthOf(selected);
  const grid = React.useMemo(() => monthGridDates(month), [month]);
  const week = React.useMemo(() => weekDates(selected), [selected]);
  const from = view === "month" ? grid[0] : week[0];
  const to = view === "month" ? grid[grid.length - 1] : week[6];

  /* ───────────── Events ───────────── */

  const cache = React.useRef(new Map<string, CacheEntry>());
  const reqId = React.useRef(0);
  const [data, setData] = React.useState<CalendarEventsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [external, setExternal] = React.useState<ExternalCalendarState>({ connected: false });

  const load = React.useCallback(async (f: string, t: string, opts: { force?: boolean } = {}) => {
    const key = `${f}_${t}`;
    const hit = cache.current.get(key);
    const id = ++reqId.current;
    if (hit && !opts.force) {
      setData(hit.res);
      setExternal(hit.res.external);
      setError(null);
      setLoading(false);
      if (Date.now() - hit.at < STALE_MS) return;
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.get<CalendarEventsResponse>(`/calendar/events?from=${f}&to=${t}`);
      cache.current.set(key, { at: Date.now(), res });
      if (id === reqId.current) {
        setData(res);
        setExternal(res.external);
      }
    } catch (e) {
      if (id === reqId.current && !(hit && !opts.force)) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(from, to);
  }, [from, to, load]);

  const refresh = () => {
    cache.current.clear();
    void load(from, to, { force: true });
  };

  const byDate = React.useMemo(() => groupByDate(data?.events ?? [], tz), [data, tz]);
  const dayEvents = byDate.get(selected) ?? [];
  const hasRange = data?.from === from && data?.to === to;

  /* ───────────── Feed + connection status ───────────── */

  const [status, setStatus] = React.useState<CalendarStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(true);
  const [statusError, setStatusError] = React.useState<string | null>(null);

  const loadStatus = React.useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await api.get<CalendarStatusResponse>("/calendar");
      setStatus(res);
      setExternal((prev) => (prev.connected === res.external.connected ? { ...res.external, ...prev } : res.external));
    } catch (e) {
      setStatusError(errorMessage(e));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onFeedChange = (feed: CalendarFeedLinks | null, isLocal?: boolean) =>
    setStatus((s) => (s ? { ...s, feed, is_local: isLocal ?? s.is_local } : s));

  const onExternalChange = (next: ExternalCalendarState) => {
    setExternal(next);
    setStatus((s) => (s ? { ...s, external: next } : s));
    cache.current.clear();
    void load(from, to, { force: true });
  };

  /* ───────────── Navigation ───────────── */

  const go = (delta: number) => {
    if (view === "week") {
      setSelected((d) => addDays(d, delta * 7));
      return;
    }
    const target = shiftMonth(month, delta);
    setSelected(monthOf(today) === target ? today : `${target}-01`);
  };
  const isCurrent = view === "month" ? month === monthOf(today) : week.includes(today);
  const title = view === "month" ? formatMonth(month) : formatWeekRange(week);

  const kinds = KIND_ORDER.filter((k) => k !== "external" || external.connected);
  const navBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-orza-muted transition-colors duration-150 ease-orza hover:bg-white hover:text-orza-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan";

  return (
    <div>
      <PageHeader
        eyebrow="Care · Calendar"
        title="Calendar"
        description="Medicines, reminders and meals in one view — with your own calendar alongside, so ÖRZA can help you plan food around busy days."
        actions={
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
            ]}
          />
        }
      />

      <div className={cn("grid gap-6", view === "month" && "xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start")}>
        <GlassCard as="section" aria-labelledby="calendar-title" padded={false} className="min-w-0 p-3 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
            <div className="flex items-center gap-1">
              <button type="button" className={navBtn} onClick={() => go(-1)} aria-label={view === "month" ? "Previous month" : "Previous week"}>
                <ChevronLeft size={18} strokeWidth={1.75} />
              </button>
              <h2
                id="calendar-title"
                aria-live="polite"
                className="min-w-[150px] text-center font-editorial text-[19px] font-semibold tracking-[-0.01em] text-orza-strong sm:min-w-[190px] sm:text-[21px]"
              >
                {title}
              </h2>
              <button type="button" className={navBtn} onClick={() => go(1)} aria-label={view === "month" ? "Next month" : "Next week"}>
                <ChevronRight size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {selected !== today && (
                <Button variant="secondary" size="sm" onClick={() => setSelected(today)} aria-label={isCurrent ? "Select today" : "Go to today"}>
                  Today
                </Button>
              )}
              <button type="button" className={navBtn} onClick={refresh} aria-label="Refresh calendar" disabled={loading}>
                <RotateCw size={16} strokeWidth={1.75} className={cn(loading && hasRange && "animate-spin")} />
              </button>
            </div>
          </div>

          <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 sm:mb-4" aria-label="Legend">
            {kinds.map((k) => (
              <li key={k} className="flex items-center gap-1.5 text-[12px] text-orza-muted">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: KIND_COLOR[k] }} />
                {KIND_LABEL[k]}
              </li>
            ))}
            {external.connected && (
              <li className="flex items-center gap-1.5 text-[12px] text-orza-muted">
                <span aria-hidden className="h-[3px] w-4 rounded-full bg-orza-energy" />
                Busy day (4 h+)
              </li>
            )}
          </ul>

          {error && (
            <div role="alert" className="mb-3 flex flex-wrap items-center gap-2 rounded-orza-sm border border-[rgba(176,44,44,0.18)] bg-[#FDF2F2] px-3 py-2.5 text-[13px] text-[#8A2323]">
              <CircleAlert size={15} strokeWidth={1.75} aria-hidden className="shrink-0" />
              <span className="min-w-0 flex-1">{error}</span>
              <Button variant="secondary" size="sm" onClick={() => void load(from, to, { force: true })}>
                Try again
              </Button>
            </div>
          )}
          {!error && external.connected && external.error && (
            <p className="mb-3 flex items-center gap-2 px-1 text-[12px] leading-5 text-[#7A4A00]">
              <CircleAlert size={14} strokeWidth={1.75} aria-hidden className="shrink-0" />
              <span>
                Your calendar couldn&apos;t be refreshed.{" "}
                <a href="#connect-calendar" className="font-medium underline underline-offset-2">
                  See details
                </a>
              </span>
            </p>
          )}

          {view === "month" ? (
            <MonthGrid month={month} today={today} selected={selected} byDate={byDate} tz={tz} loading={loading && !hasRange} onSelect={setSelected} />
          ) : (
            <WeekView dates={week} today={today} selected={selected} byDate={byDate} tz={tz} loading={loading && !hasRange} onSelect={setSelected} />
          )}
        </GlassCard>

        <DayAgenda
          date={selected}
          today={today}
          events={dayEvents}
          tz={tz}
          loading={loading && !hasRange}
          externalConnected={external.connected}
          className={view === "month" ? "xl:sticky xl:top-6" : undefined}
        />
      </div>

      {statusError && !status ? (
        <GlassCard className="mt-6 flex flex-wrap items-center gap-3">
          <CircleAlert size={18} strokeWidth={1.75} className="shrink-0 text-[#B02C2C]" aria-hidden />
          <p className="min-w-0 flex-1 text-[14px] text-orza-muted">Calendar settings didn&apos;t load. {statusError}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadStatus()}>
            Try again
          </Button>
        </GlassCard>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
          <Reveal>
            <SubscribeCard feed={status?.feed ?? null} isLocal={status?.is_local ?? false} loading={statusLoading && !status} onChange={onFeedChange} />
          </Reveal>
          <Reveal delay={0.06}>
            <ConnectCard external={external} loading={statusLoading && !status} onChange={onExternalChange} />
          </Reveal>
        </div>
      )}
    </div>
  );
}
