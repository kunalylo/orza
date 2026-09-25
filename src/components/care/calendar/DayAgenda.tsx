"use client";
import * as React from "react";
import Link from "next/link";
import { Bell, CalendarDays, ChevronRight, Coffee, MapPin, Pill, Sparkles, UtensilsCrossed } from "lucide-react";
import { GlassCard, Tag, type TagTone } from "@/components/orza/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { CalendarEvent, DoseEventStatus } from "./types";
import { dayInsights, formatLongDate, formatTimeRange } from "./utils";

const STATUS: Record<DoseEventStatus, { label: string; tone: TagTone }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  due: { label: "Due now", tone: "energy" },
  snoozed: { label: "Snoozed", tone: "info" },
  taken: { label: "Taken", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  missed: { label: "Missed", tone: "danger" },
};

function KindIcon({ event }: { event: CalendarEvent }) {
  const [broken, setBroken] = React.useState(false);
  if (event.kind === "medication" && event.photo_url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={event.photo_url}
        alt={`Photo of ${event.title}`}
        width={48}
        height={48}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-11 w-11 shrink-0 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white object-cover sm:h-12 sm:w-12"
      />
    );
  }
  const Icon = { medication: Pill, reminder: Bell, meal: UtensilsCrossed, external: CalendarDays }[event.kind];
  const tone = {
    medication: "bg-[#FFF1EA] text-[#E0593F] border-[rgba(255,122,106,0.28)]",
    reminder: "bg-[#E8FBFF] text-[#0B8FA6] border-[rgba(11,190,220,0.25)]",
    meal: "bg-[#FFF6E8] text-[#B06A00] border-[rgba(255,180,84,0.35)]",
    external: "bg-[#F4F1FF] text-[#6E3ED6] border-[rgba(135,87,242,0.22)]",
  }[event.kind];
  return (
    <span aria-hidden className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-orza-sm border sm:h-12 sm:w-12", tone)}>
      <Icon size={18} strokeWidth={1.75} />
    </span>
  );
}

function AgendaItem({ event, date, tz }: { event: CalendarEvent; date: string; tz: string }) {
  const status = event.status ? STATUS[event.status] : null;
  const acted = event.status === "taken" || event.status === "skipped";
  const body = (
    <>
      <span className="w-[58px] shrink-0 pt-0.5 font-mono text-[11px] leading-4 text-orza-muted sm:w-[76px]">{formatTimeRange(event, tz, date)}</span>
      <KindIcon event={event} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn("text-[15px] font-medium leading-5 text-orza-strong", acted && "text-orza-muted")}>{event.title}</span>
          {status && (
            <Tag tone={status.tone} size="sm">
              {status.label}
            </Tag>
          )}
          {event.kind === "external" && event.busy === false && (
            <Tag tone="neutral" size="sm" dot={false}>
              Free
            </Tag>
          )}
        </span>
        {event.kind === "external" && event.location ? (
          <span className="mt-0.5 flex items-center gap-1 text-[13px] leading-5 text-orza-muted">
            <MapPin size={12} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
        ) : (
          event.subtitle && <span className="mt-0.5 block text-[13px] leading-5 text-orza-muted line-clamp-2">{event.subtitle}</span>
        )}
      </span>
      {event.url && <ChevronRight size={16} strokeWidth={1.75} aria-hidden className="mt-3.5 shrink-0 text-orza-subtle transition-transform group-hover:translate-x-0.5" />}
    </>
  );
  const cls = "group flex w-full items-start gap-2.5 rounded-orza-sm px-1.5 py-2.5 text-left sm:gap-3 sm:px-2";
  if (event.url) {
    const hint =
      event.kind === "medication" ? (acted ? "Open dose details" : "Open the alarm with photos") : event.kind === "meal" ? "Open the meal log" : "Open reminders";
    return (
      <Link
        href={event.url}
        aria-label={`${event.title}, ${formatTimeRange(event, tz, date)}${status ? `, ${status.label}` : ""}. ${hint}`}
        className={cn(cls, "transition-colors duration-150 ease-orza hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan")}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Selected-day agenda: busy-day insights, then all-day items, then everything in time order. */
export function DayAgenda({
  date,
  today,
  events,
  tz,
  loading,
  externalConnected,
  className,
}: {
  date: string;
  today: string;
  events: CalendarEvent[];
  tz: string;
  loading: boolean;
  externalConnected: boolean;
  className?: string;
}) {
  const insights = React.useMemo(() => dayInsights(events, date, tz), [events, date, tz]);
  const counts = React.useMemo(() => {
    const doses = events.filter((e) => e.kind === "medication");
    return { doses: doses.length, taken: doses.filter((d) => d.status === "taken").length };
  }, [events]);
  const isToday = date === today;

  return (
    <GlassCard as="section" aria-labelledby="agenda-heading" padded={false} className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{isToday ? "Today" : date < today ? "Past day" : "Coming up"}</div>
          <h2 id="agenda-heading" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong" aria-live="polite">
            {formatLongDate(date)}
          </h2>
        </div>
        {counts.doses > 0 && date <= today && (
          <Tag tone={counts.taken === counts.doses ? "success" : "neutral"} size="sm">
            {counts.taken}/{counts.doses} doses taken
          </Tag>
        )}
      </div>

      {insights.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="Insights for this day">
          {insights.map((i) => (
            <li
              key={i.id}
              className={cn(
                "flex gap-3 rounded-orza-sm border p-3",
                i.tone === "energy" ? "border-[rgba(255,122,106,0.30)] bg-[#FFF5EF]" : "border-[rgba(11,190,220,0.25)] bg-[#EEFBFE]"
              )}
            >
              <span aria-hidden className={cn("mt-0.5 shrink-0", i.tone === "energy" ? "text-[#E0593F]" : "text-[#0B8FA6]")}>
                {i.id === "busy" || i.id === "lunch" ? <Coffee size={16} strokeWidth={1.75} /> : <Sparkles size={16} strokeWidth={1.75} />}
              </span>
              <span>
                <span className="block text-[14px] font-semibold leading-5 text-orza-strong">{i.title}</span>
                <span className="mt-0.5 block text-[13px] leading-5 text-orza-muted">{i.body}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        {loading && !events.length ? (
          <div className="space-y-3 px-2 py-2" aria-hidden>
            {[0, 1, 2].map((k) => (
              <div key={k} className="flex items-center gap-3">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-12 w-12 !rounded-orza-sm" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length ? (
          <ul className="divide-y divide-[rgba(20,20,20,0.06)]">
            {events.map((e) => (
              <li key={`${e.id}-${date}`}>
                <AgendaItem event={e} date={date} tz={tz} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.14)] bg-white/40 px-4 py-8 text-center">
            <div className="font-editorial text-[17px] font-semibold text-orza-strong">{date < today ? "Nothing logged this day" : "A clear day"}</div>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-5 text-orza-muted">
              {date < today
                ? "No doses, reminders or meals were recorded."
                : "No medicines, reminders or events here yet. Add a medicine or a reminder and it will show up on this calendar."}
            </p>
            {date >= today && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <ButtonLink href="/dashboard/medicines" size="sm" variant="secondary">
                  <Pill size={14} strokeWidth={1.75} aria-hidden /> Add a medicine
                </ButtonLink>
                <ButtonLink href="/dashboard/reminders" size="sm" variant="ghost">
                  <Bell size={14} strokeWidth={1.75} aria-hidden /> Set a reminder
                </ButtonLink>
              </div>
            )}
          </div>
        )}
      </div>

      {!externalConnected && date >= today && (
        <p className="mt-3 px-1 text-[12px] leading-5 text-orza-subtle">
          <a href="#connect-calendar" className="font-medium text-orza-muted underline decoration-[rgba(20,20,20,0.2)] underline-offset-2 hover:text-orza-strong">
            Connect your calendar
          </a>{" "}
          and ÖRZA will flag busy days so you can plan meals around them.
        </p>
      )}
    </GlassCard>
  );
}
