import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { addDays, daysBetween, isISODate, utcToZoned, zonedToUtc } from "@/lib/dates";
import { expandEvents, loadExternalCalendar } from "@/lib/care/ical-import";
import { dosesBetween, tzOf, type DoseView } from "@/lib/care/meds";
import { occurrencesBetween } from "@/lib/care/schedule";
import { badRequest, json, route } from "@/lib/http";
import type { DoseTiming, Meal, MealType, Reminder, ReminderKind, User } from "@/lib/types";
import {
  KIND_COLOR,
  MAX_RANGE_DAYS,
  type CalendarEvent,
  type CalendarEventsResponse,
  type ExternalCalendarState,
} from "@/components/care/calendar/types";
import { externalState, importErrorMessage } from "../_lib/external";

export const dynamic = "force-dynamic";

const EVENT_MINUTES = 15;
const MAX_MEALS = 2000;

const TIMING: Record<DoseTiming, string> = {
  before_food: "before food",
  after_food: "after food",
  with_food: "with food",
  empty_stomach: "on an empty stomach",
  bedtime: "at bedtime",
  any: "",
};

const REMINDER_PATH: Record<ReminderKind, string> = {
  meal: "/dashboard/meals",
  water: "/dashboard",
  weight: "/dashboard/goals",
  custom: "/dashboard/reminders",
};

const MEAL_LABEL: Record<MealType, string> = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner" };
/** Where a meal sits on the calendar when it was logged on a different day than it was eaten. */
const MEAL_SLOT: Record<MealType, string> = { breakfast: "08:30", lunch: "13:30", snack: "17:00", dinner: "20:30" };

const isRealDate = (s: unknown): s is string => {
  if (!isISODate(s)) return false;
  const t = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
};

const plusMinutes = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60000).toISOString();

function doseEvent(d: DoseView): CalendarEvent {
  return {
    id: `med_${d.medication_id}_${d.scheduled_for}`,
    kind: "medication",
    title: [d.name, d.strength].filter(Boolean).join(" "),
    subtitle: [d.dose, TIMING[d.timing] || "", d.for_person ? `for ${d.for_person}` : ""].filter(Boolean).join(" · "),
    start: d.scheduled_for,
    end: plusMinutes(d.scheduled_for, EVENT_MINUTES),
    all_day: false,
    color: KIND_COLOR.medication,
    url: `/dashboard/alarm?med=${encodeURIComponent(d.medication_id)}&at=${encodeURIComponent(d.scheduled_for)}`,
    photo_url: d.photo_urls[0],
    status: d.status,
  };
}

function reminderEvents(reminders: Reminder[], from: Date, to: Date, tz: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const r of reminders) {
    if (!r.schedule) continue;
    for (const o of occurrencesBetween(r.schedule, from, to, tz)) {
      out.push({
        id: `rem_${r.id}_${o.iso}`,
        kind: "reminder",
        title: r.title,
        subtitle: r.body || undefined,
        start: o.iso,
        end: plusMinutes(o.iso, EVENT_MINUTES),
        all_day: false,
        color: KIND_COLOR.reminder,
        url: REMINDER_PATH[r.kind] || REMINDER_PATH.custom,
      });
    }
  }
  return out;
}

function mealEvent(m: Meal, tz: string): CalendarEvent {
  const created = new Date(m.created_at);
  const loggedSameDay = !Number.isNaN(created.getTime()) && utcToZoned(created, tz).date === m.date;
  const start = loggedSameDay ? created.toISOString() : zonedToUtc(m.date, MEAL_SLOT[m.meal_type] || "13:00", tz).toISOString();
  const kcal = Math.round(Number(m.totals?.calories) || 0);
  const items = (m.items || []).map((i) => i.name).filter(Boolean);
  const described = (m.description || "").trim() || items.join(", ");
  return {
    id: `meal_${m.id}`,
    kind: "meal",
    title: `${MEAL_LABEL[m.meal_type] || "Meal"} · ${kcal} kcal`,
    subtitle: described.length > 140 ? `${described.slice(0, 137)}…` : described || undefined,
    start,
    end: plusMinutes(start, 30),
    all_day: false,
    color: KIND_COLOR.meal,
    url: `/dashboard/meals?date=${m.date}`,
    calories: kcal,
  };
}

async function externalEvents(user: User, from: Date, to: Date, tz: string): Promise<{ events: CalendarEvent[]; state: ExternalCalendarState }> {
  const url = user.integrations?.external_ical_url;
  if (!url) return { events: [], state: { connected: false } };
  try {
    const cal = await loadExternalCalendar(url, { userId: user.id });
    const events = expandEvents(cal, from, to, tz).map<CalendarEvent>((e) => ({
      id: e.id,
      kind: "external",
      title: e.title,
      subtitle: e.location,
      start: e.start,
      end: e.end,
      all_day: e.all_day,
      color: KIND_COLOR.external,
      busy: e.busy,
      location: e.location,
    }));
    return { events, state: externalState(user, { name: cal.name }) };
  } catch (e) {
    return { events: [], state: externalState(user, { error: importErrorMessage(e) }) };
  }
}

/**
 * GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD (local days, inclusive, ≤ 62 days)
 * → {from, to, tz, events, external}: medication doses (with photos + status), reminders,
 * logged meals and — when connected — the user's own calendar. An external calendar that fails
 * to load never breaks the response; its error is reported in `external.error`.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const tz = tzOf(user);
  const q = new URL(req.url).searchParams;
  const from = q.get("from");
  const to = q.get("to");
  if (!isRealDate(from) || !isRealDate(to)) throw badRequest("from and to must be dates (YYYY-MM-DD)");
  if (to < from) throw badRequest("to must be on or after from");
  if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) throw badRequest(`Ask for at most ${MAX_RANGE_DAYS} days at a time`);

  const fromUtc = zonedToUtc(from, "00:00", tz);
  const toUtc = zonedToUtc(addDays(to, 1), "00:00", tz);

  const [doses, reminders, meals, external] = await Promise.all([
    dosesBetween(user, fromUtc, toUtc),
    col<Reminder>("reminders").find({ user_id: user.id, active: true }),
    col<Meal>("meals").find({ user_id: user.id, date: { $gte: from, $lte: to } }, { sort: { created_at: 1 }, limit: MAX_MEALS }),
    externalEvents(user, fromUtc, toUtc, tz),
  ]);

  const events: CalendarEvent[] = [
    ...doses.map(doseEvent),
    ...reminderEvents(reminders, fromUtc, toUtc, tz),
    ...meals.map((m) => mealEvent(m, tz)),
    ...external.events,
  ];
  const sortKey = (e: CalendarEvent) => (e.all_day ? zonedToUtc(e.start, "00:00", tz).getTime() - 1 : Date.parse(e.start));
  events.sort((a, b) => sortKey(a) - sortKey(b) || a.title.localeCompare(b.title));

  const body: CalendarEventsResponse = { from, to, tz, events, external: external.state };
  return json(body, { headers: { "Cache-Control": "no-store" } });
});
