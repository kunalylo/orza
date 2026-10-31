/**
 * Medication dose engine: expands schedules into doses, merges dose logs, and records actions.
 * Shared by the medicines UI, /api/meds/today, the in-app alarm, the push/WhatsApp dispatcher and the calendar feed.
 * Adherence rebuilds past days with `doseHistoryBetween` (the schedule that applied then, plus every recorded Take / Skip).
 */
import { col, isDuplicateKey, nowISO } from "@/lib/db";
import { addDays, DEFAULT_TZ, utcToZoned } from "@/lib/dates";
import { badRequest, HttpError, notFound } from "@/lib/http";
import { mediaUrl } from "@/lib/media";
import { occurrencesBetween, occurrencesOnDate, type Occurrence } from "@/lib/care/schedule";
import type { DoseLog, DoseStatus, Medication, MedicationScheduleVersion, Schedule, User } from "@/lib/types";

/** Minutes after the scheduled time before an unacted dose counts as missed. */
export const MISSED_AFTER_MIN = 60;
/** Past schedule versions kept per medicine (the oldest are dropped first). */
export const MAX_SCHEDULE_HISTORY = 50;
/** Error code of the 409 for a Skip / Snooze over a dose already taken. */
export const DOSE_ALREADY_TAKEN = "dose_already_taken";
/** A dose can be acted on this far from its time (and a client's `acted_at` can be this far before it). */
const ACTION_WINDOW_MS = 36 * 3600000;
const DEFAULT_SNOOZE_MINUTES = 10;
/** Doses scheduled more than this before a medicine was added aren't its doses (see `dosesBetween`). */
const CREATED_GRACE_MS = 30 * 60000;
/** Widest gap between two timezones' clocks (UTC−12 … UTC+14): how far a dose's instant moves when the profile timezone changes. */
const TZ_SPREAD_MS = 26 * 3600000;

export type DoseViewStatus = "upcoming" | "due" | "taken" | "skipped" | "snoozed" | "missed";

export interface DoseView {
  medication_id: string;
  name: string;
  strength?: string;
  dose: string;
  form: Medication["form"];
  timing: Medication["timing"];
  instructions?: string;
  for_person?: string;
  photo_ids: string[];
  photo_urls: string[];
  scheduled_for: string; // ISO UTC
  local_date: string;
  local_time: string;
  status: DoseViewStatus;
  snooze_until?: string;
  acted_at?: string;
}

export type MedicationClient = Omit<Medication, "schedule_history"> & { photo_urls: string[] };

export const tzOf = (user: Pick<User, "profile">) => user.profile?.timezone || DEFAULT_TZ;

/** Medication as sent to the owner's browser (adds owner-only photo URLs; the schedule history stays on the server). */
export function medicationToClient(m: Medication): MedicationClient {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { schedule_history, ...rest } = m;
  return { ...rest, photo_urls: (m.photo_ids || []).map((id) => mediaUrl(id)) };
}

export function doseLogId(medicationId: string, scheduledFor: string) {
  return `${medicationId}:${scheduledFor}`;
}

/** Status of one scheduled dose at `now`. */
export function doseStatus(at: Date, log: DoseLog | undefined, now: Date = new Date()): DoseViewStatus {
  if (log?.status === "taken" || log?.status === "skipped") return log.status;
  if (log?.status === "snoozed" && log.snooze_until) {
    return new Date(log.snooze_until) > now ? "snoozed" : "due";
  }
  if (at > now) return "upcoming";
  return now.getTime() - at.getTime() <= MISSED_AFTER_MIN * 60000 ? "due" : "missed";
}

export async function activeMedications(userId: string): Promise<Medication[]> {
  return col<Medication>("medications").find({ user_id: userId, active: true }, { sort: { created_at: 1 } });
}

/** One scheduled dose of `m` with its log merged in. */
function doseView(m: Medication, o: Occurrence, log: DoseLog | undefined, now: Date): DoseView {
  return {
    medication_id: m.id,
    name: m.name,
    strength: m.strength,
    dose: m.dose,
    form: m.form,
    timing: m.timing,
    instructions: m.instructions,
    for_person: m.for_person,
    photo_ids: m.photo_ids || [],
    photo_urls: (m.photo_ids || []).map((id) => mediaUrl(id)),
    scheduled_for: o.iso,
    local_date: o.local_date,
    local_time: o.local_time,
    status: doseStatus(o.at, log, now),
    snooze_until: log?.snooze_until,
    acted_at: log?.acted_at,
  };
}

const byTimeThenName = (a: DoseView, b: DoseView) => a.scheduled_for.localeCompare(b.scheduled_for) || a.name.localeCompare(b.name);

/**
 * All scheduled doses of the user's active, non-SOS medicines with `from <= at < to`,
 * merged with their dose logs. Sorted by time.
 */
export async function dosesBetween(user: User, from: Date, to: Date, now: Date = new Date(), meds?: Medication[]): Promise<DoseView[]> {
  const tz = tzOf(user);
  const list = (meds || (await activeMedications(user.id))).filter((m) => m.active && !m.as_needed);
  if (!list.length) return [];
  // Doses scheduled well before the medicine was added (e.g. this morning's 08:00 for a medicine added at 16:00)
  // were never the user's to take in ÖRZA — don't list them as missed. 30 min grace covers "adding the one I take now".
  const occ = list.flatMap((m) => {
    const since = Date.parse(m.created_at) - CREATED_GRACE_MS;
    return occurrencesBetween(m.schedule, from, to, tz)
      .filter((o) => !Number.isFinite(since) || o.at.getTime() >= since)
      .map((o) => ({ m, o }));
  });
  if (!occ.length) return [];
  const logs = await col<DoseLog>("dose_logs").find({
    user_id: user.id,
    id: { $in: occ.map(({ m, o }) => doseLogId(m.id, o.iso)) },
  });
  const byId = new Map(logs.map((l) => [l.id, l]));
  return occ.map(({ m, o }) => doseView(m, o, byId.get(doseLogId(m.id, o.iso)), now)).sort(byTimeThenName);
}

/** Doses on the user's local calendar day `date` (YYYY-MM-DD). */
export async function dosesForLocalDay(user: User, date: string, now: Date = new Date()): Promise<DoseView[]> {
  const tz = tzOf(user);
  // Window wide enough to cover any UTC offset; filter to the local date afterwards.
  const [y, m, d] = date.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d) - 15 * 3600000);
  const to = new Date(Date.UTC(y, m - 1, d) + 39 * 3600000);
  return (await dosesBetween(user, from, to, now)).filter((x) => x.local_date === date && utcToZoned(new Date(x.scheduled_for), tz).date === date);
}

/* ───────────────────────────── History (adherence) ───────────────────────────── */

/** Log statuses that record something the person did. */
const ACTED_STATUSES = new Set<DoseStatus>(["taken", "skipped", "snoozed"]);

/** The user's dose logs for doses scheduled in `from <= at < to`. */
export async function doseLogsBetween(userId: string, from: Date, to: Date): Promise<DoseLog[]> {
  if (to <= from) return [];
  return col<DoseLog>("dose_logs").find({
    user_id: userId,
    // A log's `local_date` is within a day of its UTC date: narrows the scan on the {user_id, local_date} index.
    local_date: { $gte: addDays(from.toISOString().slice(0, 10), -1), $lte: addDays(to.toISOString().slice(0, 10), 1) },
    scheduled_for: { $gte: from.toISOString(), $lt: to.toISOString() },
  });
}

export interface ScheduleSpan {
  /** Epoch ms, inclusive (-Infinity: since the medicine was added). */
  from: number;
  /** Epoch ms, exclusive (Infinity: still current). */
  to: number;
  schedule: Schedule;
  active: boolean;
  as_needed: boolean;
}

/**
 * The schedules a medicine had over time, oldest first: each `schedule_history` version up to its `until`, then the
 * current one. A medicine without history (never edited since history was kept) has one span — its current state.
 */
export function scheduleSpans(m: Pick<Medication, "schedule" | "active" | "as_needed" | "schedule_history">): ScheduleSpan[] {
  const spans: ScheduleSpan[] = [];
  let from = -Infinity;
  for (const v of m.schedule_history || []) {
    const until = Date.parse(v?.until);
    if (!v?.schedule || !Number.isFinite(until) || until <= from) continue;
    spans.push({ from, to: until, schedule: v.schedule, active: v.active !== false, as_needed: v.as_needed === true });
    from = until;
  }
  spans.push({ from, to: Infinity, schedule: m.schedule, active: m.active, as_needed: m.as_needed });
  return spans;
}

/** `schedule_history` after an edit at `at` that replaces the medicine's current schedule / active / as_needed. */
export function withScheduleVersion(m: Pick<Medication, "schedule" | "active" | "as_needed" | "schedule_history">, at: string): MedicationScheduleVersion[] {
  const version: MedicationScheduleVersion = { schedule: m.schedule, active: m.active, as_needed: m.as_needed, until: at };
  return [...(m.schedule_history || []), version].slice(-MAX_SCHEDULE_HISTORY);
}

const hasScheduleHistory = (m: Pick<Medication, "schedule_history">) => !!m.schedule_history?.length;

/**
 * Medicines paused or edited before `schedule_history` was kept (none on the document) only show their current
 * state, so adherence guesses their past — carefully, and only for them (a medicine with history is rebuilt exactly):
 * - Paused: its current schedule counts as active until `updated_at`, the latest it can have been paused (usually
 *   exactly then), so doses missed before the pause still count; none after it. (A later edit of another field, a
 *   photo or a stock change moves `updated_at` on, which can count a few more missed doses than there were.)
 * - Times edited: past days carry logs at the old times. On a local day with a log the current schedule doesn't have,
 *   the logs are trusted — that day's current-schedule slots without a log aren't added, unless they're at or after
 *   `updated_at` (then the current schedule already applied). See `doseHistoryBetween`.
 */
function adherenceSpans(m: Medication): ScheduleSpan[] {
  const spans = scheduleSpans(m);
  const pausedBy = Date.parse(m.updated_at);
  if (hasScheduleHistory(m) || m.active || !Number.isFinite(pausedBy)) return spans;
  return [
    { ...spans[0], to: pausedBy, active: true },
    { ...spans[0], from: pausedBy },
  ];
}

/** Whether log `l` (for instant `at`) is for a time `schedule` has: by instant, or by the local date and time it was logged for. */
function onSchedule(schedule: Schedule, l: DoseLog, at: Date, tz: string): boolean {
  return (
    occurrencesOnDate(schedule, utcToZoned(at, tz).date, tz).some((x) => x.iso === at.toISOString()) ||
    occurrencesOnDate(schedule, l.local_date, tz).some((x) => x.local_time === l.local_time)
  );
}

/**
 * Whether occurrence `o` of span `s` was still on the medicine's schedule when it was decided: when its hour to be
 * taken ran out — for a snoozed dose, an hour after the snooze ended — or now, if sooner. A dose still open when an
 * edit replaced its version (08:00 moved to 09:00 at 08:45, paused at 08:10, snoozed at 08:05 and moved at 08:45) left
 * with it — today's list drops it and it can't be acted on — so it only counts if the version then in effect kept it.
 */
function scheduledUntilMissed(spans: ScheduleSpan[], s: ScheduleSpan, o: Occurrence, log: DoseLog | undefined, now: Date, tz: string): boolean {
  const snoozeEnd = log?.status === "snoozed" && log.snooze_until ? Date.parse(log.snooze_until) : NaN;
  const openUntil = Math.max(o.at.getTime(), Number.isFinite(snoozeEnd) ? snoozeEnd : -Infinity) + MISSED_AFTER_MIN * 60000;
  const decided = Math.min(openUntil, now.getTime());
  if (decided < s.to) return true;
  const then = spans.find((x) => x.from <= decided && decided < x.to);
  return !!then && then.active && !then.as_needed && occurrencesOnDate(then.schedule, o.local_date, tz).some((x) => x.iso === o.iso);
}

/**
 * Every dose of the user's medicines (active, paused or since made SOS) due in `from <= at < to` as it was:
 * the occurrences of the schedule that applied at the time (`scheduleSpans`; the same 30 min "added" grace as
 * `dosesBetween`; a dose still open — not yet missed, or snoozed — when an edit removed it doesn't count), plus every
 * recorded Take / Skip even when its slot has since left the schedule, the medicine was paused or edited. One entry
 * per slot: a log joins its slot by instant, else (the profile timezone changed since, which moves every slot) by the
 * local date and time it was logged for. A snooze that ended over an hour ago without a Take or Skip counts as missed.
 * Medicines without `schedule_history` (paused / edited before it was kept) get the guesses in `adherenceSpans`.
 * For adherence and medicine history — alarms and today's list use `dosesBetween`.
 * Deleted medicines have no logs left (DELETE /api/meds/[id] removes them), so they don't count.
 */
export async function doseHistoryBetween(user: User, from: Date, to: Date, now: Date = new Date(), meds?: Medication[]): Promise<DoseView[]> {
  if (to <= from) return [];
  const tz = tzOf(user);
  const list = meds || (await col<Medication>("medications").find({ user_id: user.id }, { sort: { created_at: 1 }, limit: 500 }));
  if (!list.length) return [];

  // Every occurrence of the schedule in effect at its time, with its span: whether one that an edit replaced still
  // counts is decided once its log is known (a snooze keeps a dose open longer). Log-only slots have no span.
  const slots = new Map<string, { m: Medication; o: Occurrence; spans?: ScheduleSpan[]; span?: ScheduleSpan }>();
  for (const m of list) {
    const since = Date.parse(m.created_at) - CREATED_GRACE_MS;
    const spans = adherenceSpans(m);
    for (const s of spans) {
      if (!s.active || s.as_needed) continue;
      const a = Math.max(from.getTime(), s.from);
      const b = Math.min(to.getTime(), s.to);
      if (a >= b) continue;
      for (const o of occurrencesBetween(s.schedule, new Date(a), new Date(b), tz)) {
        if (Number.isFinite(since) && o.at.getTime() < since) continue;
        slots.set(doseLogId(m.id, o.iso), { m, o, spans, span: s });
      }
    }
  }

  const wallClock = (medicationId: string, date: string, time: string) => `${medicationId} ${date} ${time}`;
  const slotAtWallClock = new Map([...slots].map(([id, { m, o }]) => [wallClock(m.id, o.local_date, o.local_time), id]));
  const medsById = new Map(list.map((m) => [m.id, m]));
  const logs = new Map<string, DoseLog>();
  const unmatched: DoseLog[] = [];
  // Widened by the largest timezone gap: a log written in another timezone may belong to a slot in range.
  for (const l of await doseLogsBetween(user.id, new Date(from.getTime() - TZ_SPREAD_MS), new Date(to.getTime() + TZ_SPREAD_MS))) {
    const at = new Date(l.scheduled_for);
    if (!medsById.has(l.medication_id) || !ACTED_STATUSES.has(l.status) || Number.isNaN(at.getTime())) continue;
    const id = doseLogId(l.medication_id, at.toISOString());
    if (slots.has(id)) logs.set(id, l);
    else unmatched.push(l);
  }
  // "<medicine> <local date>" of days with a log at a time the current schedule doesn't have (no-history medicines only).
  const oldScheduleDays = new Set<string>();
  for (const l of unmatched) {
    // Logged in the timezone the profile had then: the same dose is now the slot with that local date and time.
    const slotId = slotAtWallClock.get(wallClock(l.medication_id, l.local_date, l.local_time));
    if (slotId && !logs.has(slotId)) {
      logs.set(slotId, l);
      continue;
    }
    const m = medsById.get(l.medication_id)!;
    const at = new Date(l.scheduled_for);
    const local = utcToZoned(at, tz);
    const oldSchedule = !hasScheduleHistory(m) && !onSchedule(m.schedule, l, at, tz);
    if (oldSchedule) oldScheduleDays.add(`${m.id} ${local.date}`);
    if (at < from || at >= to) continue;
    // Recorded for a slot the schedule no longer has: a Take or Skip was due then. A Snooze left the dose open, and an
    // open dose an edit removed doesn't count — except at a no-history medicine's old times (its logs are trusted).
    if (l.status === "snoozed" && !oldSchedule) continue;
    const id = doseLogId(l.medication_id, at.toISOString());
    slots.set(id, { m, o: { at, iso: at.toISOString(), local_date: local.date, local_time: local.time } });
    logs.set(id, l);
  }

  return [...slots.entries()]
    .flatMap(([id, { m, o, spans, span }]) => {
      const log = logs.get(id);
      const acted = log?.status === "taken" || log?.status === "skipped";
      if (spans && span && !acted && !scheduledUntilMissed(spans, span, o, log, now, tz)) return [];
      // A no-history medicine's day at its old times (`adherenceSpans`): its current schedule didn't apply yet.
      if (!log && oldScheduleDays.has(`${m.id} ${o.local_date}`) && !(o.at.getTime() >= Date.parse(m.updated_at))) return [];
      const view = doseView(m, o, log, now);
      // `doseStatus` keeps a lapsed snooze "due" for the alarm screens; looking back, it was missed.
      if (view.status === "due" && log?.status === "snoozed" && log.snooze_until && now.getTime() - Date.parse(log.snooze_until) > MISSED_AFTER_MIN * 60000) {
        view.status = "missed";
      }
      return [view];
    })
    .sort(byTimeThenName);
}

export interface ActedDose {
  medication_id: string;
  scheduled_for: string;
  local_date: string;
  local_time: string;
  status: "taken" | "skipped" | "snoozed";
  acted_at?: string;
  snooze_until?: string;
}

/**
 * Recorded Take / Skip / Snooze logs for doses on the user's local days `fromDate` … `toDate` (inclusive, YYYY-MM-DD),
 * sorted by time. Local date and time are those of `scheduled_for` in the user's current timezone (as /api/meds/today).
 */
export async function actedDosesForLocalDays(user: User, fromDate: string, toDate: string): Promise<ActedDose[]> {
  const tz = tzOf(user);
  // Window wide enough for any UTC offset; filtered to the local dates afterwards.
  const from = new Date(Date.parse(`${fromDate}T00:00:00Z`) - 15 * 3600000);
  const to = new Date(Date.parse(`${addDays(toDate, 1)}T00:00:00Z`) + 15 * 3600000);
  const out: ActedDose[] = [];
  for (const l of await doseLogsBetween(user.id, from, to)) {
    const at = new Date(l.scheduled_for);
    if (!ACTED_STATUSES.has(l.status) || Number.isNaN(at.getTime())) continue;
    const local = utcToZoned(at, tz);
    if (local.date < fromDate || local.date > toDate) continue;
    out.push({
      medication_id: l.medication_id,
      scheduled_for: at.toISOString(),
      local_date: local.date,
      local_time: local.time,
      status: l.status as ActedDose["status"],
      ...(l.acted_at ? { acted_at: l.acted_at } : {}),
      ...(l.snooze_until ? { snooze_until: l.snooze_until } : {}),
    });
  }
  return out.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.medication_id.localeCompare(b.medication_id));
}

/* ───────────────────────────── Actions ───────────────────────────── */

const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;

/** A client-sent ISO 8601 instant with a zone ("…Z" or "…+05:30") → Date; anything else → null. */
export function parseClientInstant(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!ISO_INSTANT_RE.test(s)) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** When the person acted: the client's `acted_at` clamped to [dose time − 36 h, now]; `now` when absent or unparsable. */
export function actedAtFor(clientActedAt: unknown, scheduledFor: Date, now: Date): Date {
  const t = parseClientInstant(clientActedAt);
  if (!t) return now;
  return new Date(Math.min(now.getTime(), Math.max(scheduledFor.getTime() - ACTION_WINDOW_MS, t.getTime())));
}

/**
 * When a snooze ends: the client's absolute `snoozeUntil` clamped to now + 1 … 60 min; otherwise (absent or
 * unparsable) now + `snoozeMinutes` (5–60, default 10).
 */
export function snoozeEndFor(opts: { snoozeUntil?: unknown; snoozeMinutes?: number }, now: Date): Date {
  const until = parseClientInstant(opts.snoozeUntil);
  if (until) return new Date(Math.min(now.getTime() + 60 * 60000, Math.max(now.getTime() + 60000, until.getTime())));
  const asked = Number.isFinite(opts.snoozeMinutes) ? Math.round(opts.snoozeMinutes as number) : DEFAULT_SNOOZE_MINUTES;
  return new Date(now.getTime() + Math.min(60, Math.max(5, asked)) * 60000);
}

export interface DoseActionOptions {
  /** Snooze length counted from now, 5–60 min (default 10). */
  snoozeMinutes?: number;
  /** Absolute end of a snooze (ISO); wins over `snoozeMinutes`. See `snoozeEndFor`. */
  snoozeUntil?: string;
  /** When the person pressed the button (ISO), e.g. on a phone that was offline or asleep. See `actedAtFor`. */
  actedAt?: string;
  /** Allow Skip / Snooze over a dose already taken (a deliberate correction); the stock unit that Take used is given back. */
  override?: boolean;
}

/**
 * Record Take / Skip / Snooze for one scheduled dose. Validates ownership and that `scheduledFor`
 * is a real occurrence of the medicine's schedule (±36 h window) so arbitrary logs can't be written.
 * "take" decrements stock once (not again if the dose was already taken, nor for a second Take at the same time) and
 * marks the log `stock_used`. Skip / Snooze over a dose already taken is refused with 409 `dose_already_taken` unless
 * `override` is set — also when the Take arrives at the same moment (the write is conditional, not read-then-write).
 * The returned log never carries `stock_used`.
 */
export async function recordDoseAction(
  user: User,
  medicationId: string,
  scheduledFor: string,
  action: "take" | "skip" | "snooze",
  opts: DoseActionOptions = {}
): Promise<DoseLog> {
  const med = await col<Medication>("medications").findOne({ id: medicationId, user_id: user.id });
  if (!med) throw notFound("Medicine not found");
  const at = new Date(scheduledFor);
  if (Number.isNaN(at.getTime())) throw badRequest("Invalid dose time");
  const tz = tzOf(user);
  const window = occurrencesBetween(med.schedule, new Date(at.getTime() - ACTION_WINDOW_MS), new Date(at.getTime() + ACTION_WINDOW_MS), tz);
  const occ = window.find((o) => o.at.getTime() === at.getTime());
  if (!occ || med.as_needed) throw badRequest("That dose isn't on this medicine's schedule");

  const id = doseLogId(med.id, occ.iso);
  const logs = col<DoseLog>("dose_logs");
  const prev = await logs.findOne({ id, user_id: user.id });
  // A late or queued Skip / Snooze (another device, an alarm pressed offline) must not undo a Take.
  const guarded = action !== "take" && !opts.override;
  const alreadyTaken = () =>
    new HttpError(409, `${med.name} is already marked as taken, so this dose wasn't ${action === "skip" ? "skipped" : "snoozed"}.`, DOSE_ALREADY_TAKEN);
  if (guarded && prev?.status === "taken") throw alreadyTaken();
  const status: DoseStatus = action === "take" ? "taken" : action === "skip" ? "skipped" : "snoozed";
  const now = new Date();
  const set: Partial<DoseLog> = {
    status,
    acted_at: actedAtFor(opts.actedAt, occ.at, now).toISOString(),
    snooze_until: action === "snooze" ? snoozeEndFor(opts, now).toISOString() : undefined,
  };
  // Guarded, the write only applies while the log isn't "taken", so a Take landing after the read above still wins:
  // the filter then matches nothing and the upsert's insert hits the log's unique id (E11000).
  const write = () =>
    logs.findOneAndUpdate(
      { id, user_id: user.id, ...(guarded ? { status: { $ne: "taken" } } : {}) },
      {
        $set: Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined)),
        ...(action !== "snooze" ? { $unset: { snooze_until: 1 } } : {}),
        $setOnInsert: {
          medication_id: med.id,
          scheduled_for: occ.iso,
          local_date: occ.local_date,
          local_time: occ.local_time,
          created_at: nowISO(),
        },
      },
      { upsert: true }
    );
  let log: DoseLog | null;
  try {
    log = await write();
  } catch (e) {
    if (!isDuplicateKey(e)) throw e;
    // Another request created this log first: write over it — unless it's a Take, which fails a guarded write again.
    log = await write().catch((retryError) => {
      throw guarded && isDuplicateKey(retryError) ? alreadyTaken() : retryError;
    });
  }

  if (action === "take" && prev?.status !== "taken" && med.stock && typeof med.stock.count === "number" && med.stock.count > 0) {
    // A Take uses one unit of tracked stock, once per dose; the log's `stock_used` remembers it so an override gives
    // back only a real one. Claiming the flag (only while the log is "taken") means two Takes at once use one unit.
    const { matched } = await logs.updateOne({ id, user_id: user.id, status: "taken", stock_used: { $exists: false } }, { $set: { stock_used: true } });
    if (matched) {
      await col<Medication>("medications").updateOne({ id: med.id, user_id: user.id }, { $inc: { "stock.count": -1 }, $set: { updated_at: nowISO() } });
    }
  } else if (action !== "take" && prev?.status === "taken" && prev.stock_used) {
    // An override: the Take is undone, so is the tablet it used. Claiming the flag first (only while the log isn't
    // "taken") means a repeated or concurrent override can't give it back twice, nor take it from a Take that landed
    // meanwhile (a Take logged before the flag existed gives nothing back).
    const { matched } = await logs.updateOne({ id, user_id: user.id, stock_used: true, status: { $ne: "taken" } }, { $unset: { stock_used: 1 } });
    if (matched && med.stock && typeof med.stock.count === "number") {
      await col<Medication>("medications").updateOne({ id: med.id, user_id: user.id }, { $inc: { "stock.count": 1 }, $set: { updated_at: nowISO() } });
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { stock_used, ...dose } = log as DoseLog;
  return dose;
}
