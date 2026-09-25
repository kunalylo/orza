import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normaliseDays, upsertHealthDays, userTz } from "@/lib/care/health";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { IMPORT_SOURCES, MAX_IMPORT_DAYS } from "@/components/care/health/metrics";

export const dynamic = "force-dynamic";
/** A year of days is a few hundred upserts; give slow database round trips room. */
export const maxDuration = 60;

const metric = z.union([z.number(), z.string().max(32), z.null()]).optional();

const Day = z
  .object({
    date: z.string().max(40),
    steps: metric,
    active_kcal: metric,
    distance_km: metric,
    sleep_minutes: metric,
    resting_hr: metric,
    avg_hr: metric,
    weight_kg: metric,
    water_ml: metric,
  })
  .strip();

const Body = z.object({
  source: z.enum(IMPORT_SOURCES),
  days: z.array(Day).min(1, "has no days to import").max(MAX_IMPORT_DAYS, `can hold at most ${MAX_IMPORT_DAYS} days per import`),
});

/**
 * POST /api/health/import {source: "apple_health" | "csv", days: [...] (≤ 400)} → `{ok, days_updated, skipped}`.
 * Daily aggregates prepared in the browser (Apple Health export.zip or a CSV) — raw files never leave the device.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const { days, skipped } = normaliseDays(body.days, { tz: userTz(user) });
  if (!days.length) throw badRequest("None of those days had a valid date and a value in range, so nothing was imported.");
  const { days_updated } = await upsertHealthDays(user, body.source, days);
  return json({ ok: true, days_updated, skipped });
});
