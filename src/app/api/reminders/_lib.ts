/** Validation + serialisation shared by /api/reminders and /api/reminders/[id]. */
import { z } from "zod";
import { dateInTz, isHHMM, isISODate } from "@/lib/dates";
import { tzOf } from "@/lib/care/meds";
import { nextOccurrence, normalizeTimes } from "@/lib/care/schedule";
import { badRequest } from "@/lib/http";
import { MAX_TIMES_PER_REMINDER, REMINDER_KINDS, type ReminderView } from "@/components/care/reminders/shared";
import type { Reminder, Schedule, User } from "@/lib/types";

/** YYYY-MM-DD that is also a real calendar day (rejects 2026-02-30). */
const realDate = (s: string) => {
  if (!isISODate(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const hhmm = z.string().refine(isHHMM, "Times must look like 08:30 (24-hour)");
const day = z.string().refine(realDate, "Dates must look like 2026-01-31");

export const scheduleInput = z.object({
  times: z.array(hhmm).min(1, "Add at least one time").max(MAX_TIMES_PER_REMINDER, `Up to ${MAX_TIMES_PER_REMINDER} times a day`),
  days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  start_date: day.optional(),
  end_date: day.nullable().optional(),
  every_n_days: z.number().int().min(1, "Repeat at least every day").max(30, "Repeat at most every 30 days").nullable().optional(),
});

export const channelsInput = z.object({
  push: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
  calendar: z.boolean().optional(),
});

const kind = z.enum(REMINDER_KINDS as [Reminder["kind"], ...Reminder["kind"][]], {
  errorMap: () => ({ message: "Choose meal, water, weigh-in or custom" }),
});
const title = z.string().trim().min(1, "Give the reminder a title").max(80, "Keep the title under 80 characters");
const body = z.string().trim().max(240, "Keep the message under 240 characters").nullable().optional();

export const createInput = z.object({
  kind,
  title,
  body,
  schedule: scheduleInput,
  channels: channelsInput.optional(),
  active: z.boolean().optional(),
});

export const patchInput = z.object({
  kind: kind.optional(),
  title: title.optional(),
  body,
  schedule: scheduleInput.partial().optional(),
  channels: channelsInput.optional(),
  active: z.boolean().optional(),
});

/** Merge schedule input over an existing schedule (or defaults) into a clean, valid Schedule. */
export function buildSchedule(input: z.infer<typeof scheduleInput> | Partial<z.infer<typeof scheduleInput>>, user: User, base?: Schedule): Schedule {
  const times = normalizeTimes(input.times ?? base?.times ?? []);
  if (!times.length) throw badRequest("Add at least one time");
  const daysRaw = input.days ?? base?.days ?? [];
  const days = [...new Set(daysRaw)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const start_date = input.start_date ?? base?.start_date ?? dateInTz(tzOf(user));
  const end_date = input.end_date === null ? undefined : input.end_date ?? base?.end_date;
  if (end_date && end_date < start_date) throw badRequest("The end date can't be before the start date");
  const n = input.every_n_days === null ? 1 : input.every_n_days ?? base?.every_n_days ?? 1;
  const schedule: Schedule = { times, days: days.length === 7 ? [] : days, start_date };
  if (end_date) schedule.end_date = end_date;
  if (n > 1) schedule.every_n_days = n;
  return schedule;
}

export function toView(r: Reminder, user: User, now: Date = new Date()): ReminderView {
  const next = r.active ? nextOccurrence(r.schedule, new Date(now.getTime() - 1), tzOf(user), 60) : null;
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    schedule: r.schedule,
    channels: r.channels,
    active: r.active,
    created_at: r.created_at,
    updated_at: r.updated_at,
    next_at: next ? next.iso : null,
  };
}
