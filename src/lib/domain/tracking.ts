import { col, isDuplicateKey, newId, nowISO } from "@/lib/db";
import type { StepsMode, StepsRefusal, TrackingDay } from "@/lib/types";

export const STEPS_MODES = ["manual", "auto", "reconcile"] as const satisfies readonly StepsMode[];

/** The day's steps edit marker, or null when the member hasn't set the day's steps themselves. */
export const stepsMarkerOf = (t: Pick<TrackingDay, "steps_edited_at"> | null | undefined) =>
  typeof t?.steps_edited_at === "string" && t.steps_edited_at ? t.steps_edited_at : null;

/** A tracking row as the API returns it: `steps_edited_at` always present (null on rows without an edit, old ones too). */
export function withStepsMarker(t: TrackingDay): TrackingDay & { steps_edited_at: string | null } {
  return { ...t, steps_edited_at: stepsMarkerOf(t) };
}

export async function getTrackingDay(userId: string, date: string): Promise<TrackingDay & { steps_edited_at: string | null }> {
  const d = await col<TrackingDay>("tracking").findOne({ user_id: userId, date });
  return withStepsMarker(d || { id: "", user_id: userId, date, water_glasses: 0, steps: 0, updated_at: "" });
}

/**
 * Upsert fields for a day (e.g. { water_glasses: 5 } or { weight_kg: 71.2 }). Steps are written only through the save
 * modes below (`setStepsManual`, `raiseSteps`, `reconcileSteps`), which keep the day's edit marker right.
 */
export async function setTracking(userId: string, date: string, fields: Partial<Pick<TrackingDay, "water_glasses" | "weight_kg">>) {
  // Mongo rejects the same path in $set and $setOnInsert, so only default the untouched counters.
  const onInsert: Record<string, unknown> = { id: newId(), steps: 0 };
  if (!("water_glasses" in fields)) onInsert.water_glasses = 0;
  const doc = await col<TrackingDay>("tracking").findOneAndUpdate(
    { user_id: userId, date },
    { $set: { ...fields, updated_at: nowISO() }, $setOnInsert: onInsert },
    { upsert: true }
  );
  return doc && withStepsMarker(doc);
}

export async function trackingInRange(userId: string, from: string, to: string): Promise<TrackingDay[]> {
  const rows = await col<TrackingDay>("tracking").find({ user_id: userId, date: { $gte: from, $lte: to } }, { sort: { date: 1 } });
  return rows.map(withStepsMarker);
}

/**
 * Creates the day's row (zeros) when there is none, so a conditional write after it is a plain update: a filter like
 * `steps: {$lt: n}` that fails on an existing row must never become an upsert that hits the unique (user, date) index.
 */
export async function ensureTrackingRow(userId: string, date: string): Promise<void> {
  try {
    await col<TrackingDay>("tracking").updateOne(
      { user_id: userId, date },
      { $setOnInsert: { id: newId(), water_glasses: 0, steps: 0, updated_at: nowISO() } },
      { upsert: true }
    );
  } catch (e) {
    if (!isDuplicateKey(e)) throw e; // a concurrent write created the day first: it exists now
  }
}

/* ───────────────────────────── Steps: the three save modes (POST /api/track/steps) ───────────────────────────── */

/** A step save's outcome: the day's row as it is now, whether this save changed it, and why not. */
export interface StepsWrite {
  tracking: TrackingDay & { steps_edited_at: string | null };
  applied: boolean;
  reason?: StepsRefusal;
}

/**
 * `manual` — the member's own number for the day (the website's form, the phone's Edit / Log sheet): sets the steps and
 * the day's edit marker. Always applied.
 */
export async function setStepsManual(userId: string, date: string, steps: number): Promise<StepsWrite> {
  const now = nowISO();
  const doc = await col<TrackingDay>("tracking").findOneAndUpdate(
    { user_id: userId, date },
    { $set: { steps, steps_edited_at: now, updated_at: now }, $setOnInsert: { id: newId(), water_glasses: 0 } },
    { upsert: true }
  );
  return { tracking: doc ? withStepsMarker(doc) : await getTrackingDay(userId, date), applied: true };
}

/**
 * No mode — a caller from before the modes (app builds before steps v2, a website tab loaded before this deploy): sets
 * the steps as the server always did, leaving the day's edit marker as it is. Those builds send their automatic saves
 * and their member's own entries alike, so marking them would freeze the automatic days for the health-sync mirror and
 * for the v2 app's `auto` saves after the member upgrades. Always applied.
 */
export async function setStepsLegacy(userId: string, date: string, steps: number): Promise<StepsWrite> {
  const doc = await col<TrackingDay>("tracking").findOneAndUpdate(
    { user_id: userId, date },
    { $set: { steps, updated_at: nowISO() }, $setOnInsert: { id: newId(), water_glasses: 0 } },
    { upsert: true }
  );
  return { tracking: doc ? withStepsMarker(doc) : await getTrackingDay(userId, date), applied: true };
}

/**
 * `auto` —an automatic count (the phone's step sync): an atomic raise, refused while the day's edit marker isn't
 * `editRef` (the marker the phone has already taken into account; null = none). Never lowers.
 * Not applied → `edited` (the member set the day and the phone hasn't seen it), else `not_higher`.
 */
export async function raiseSteps(userId: string, date: string, steps: number, editRef: string | null): Promise<StepsWrite> {
  await ensureTrackingRow(userId, date);
  // `steps_edited_at: null` also matches rows without the field (Mongo; the file store does the same).
  const doc = await col<TrackingDay>("tracking").findOneAndUpdate(
    { user_id: userId, date, steps: { $lt: steps }, steps_edited_at: editRef },
    { $set: { steps, updated_at: nowISO() } }
  );
  if (doc) return { tracking: withStepsMarker(doc), applied: true };
  const now = await getTrackingDay(userId, date);
  return { tracking: now, applied: false, reason: stepsMarkerOf(now) !== editRef ? "edited" : "not_higher" };
}

/**
 * `reconcile` — a compare-and-set: the day becomes `steps` only while it still holds `expect` (the phone's own last
 * automatic save) and its edit marker is `editRef`. The phone uses it to lower its own earlier save to the health
 * store's settled total; a count anyone else saved since is left alone. Not applied → `edited`, else `changed`.
 */
export async function reconcileSteps(userId: string, date: string, steps: number, expect: number, editRef: string | null): Promise<StepsWrite> {
  const doc = await col<TrackingDay>("tracking").findOneAndUpdate(
    { user_id: userId, date, steps: expect, steps_edited_at: editRef },
    { $set: { steps, updated_at: nowISO() } }
  );
  if (doc) return { tracking: withStepsMarker(doc), applied: true };
  const now = await getTrackingDay(userId, date);
  return { tracking: now, applied: false, reason: stepsMarkerOf(now) !== editRef ? "edited" : "changed" };
}
