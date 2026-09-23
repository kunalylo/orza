import { col, newId, nowISO } from "@/lib/db";
import type { TrackingDay } from "@/lib/types";

export async function getTrackingDay(userId: string, date: string): Promise<TrackingDay> {
  const d = await col<TrackingDay>("tracking").findOne({ user_id: userId, date });
  return d || { id: "", user_id: userId, date, water_glasses: 0, steps: 0, updated_at: "" };
}

/** Upsert fields for a day (e.g. { water_glasses: 5 } or { weight_kg: 71.2 }). */
export async function setTracking(userId: string, date: string, fields: Partial<Pick<TrackingDay, "water_glasses" | "steps" | "weight_kg">>) {
  // Mongo rejects the same path in $set and $setOnInsert, so only default the untouched counters.
  const onInsert: Record<string, unknown> = { id: newId() };
  if (!("water_glasses" in fields)) onInsert.water_glasses = 0;
  if (!("steps" in fields)) onInsert.steps = 0;
  return col<TrackingDay>("tracking").findOneAndUpdate(
    { user_id: userId, date },
    { $set: { ...fields, updated_at: nowISO() }, $setOnInsert: onInsert },
    { upsert: true }
  );
}

export async function trackingInRange(userId: string, from: string, to: string): Promise<TrackingDay[]> {
  return col<TrackingDay>("tracking").find({ user_id: userId, date: { $gte: from, $lte: to } }, { sort: { date: 1 } });
}
