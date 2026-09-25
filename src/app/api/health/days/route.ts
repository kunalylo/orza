import { requireUser } from "@/lib/auth";
import { healthDocsInRange, isRealDate, lastHealthWrite, mergeHealthDays, shiftDate, summariseSources, userTz } from "@/lib/care/health";
import { dateInTz, daysBetween } from "@/lib/dates";
import { badRequest, json, route } from "@/lib/http";
import { MAX_IMPORT_DAYS } from "@/components/care/health/metrics";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/days?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults: the last 30 days; at most 400 days)
 * → `{from, to, days, sources, last_sync, last_sync_source}`; `days` is merged per date across sources.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const today = dateInTz(userTz(user));
  const qTo = url.searchParams.get("to");
  const qFrom = url.searchParams.get("from");
  if (qTo && !isRealDate(qTo)) throw badRequest("to must be a valid day in YYYY-MM-DD format");
  if (qFrom && !isRealDate(qFrom)) throw badRequest("from must be a valid day in YYYY-MM-DD format");
  const to = qTo || today;
  const from = qFrom || shiftDate(to, -29);
  if (from > to) throw badRequest("from must be on or before to");
  if (daysBetween(from, to) + 1 > MAX_IMPORT_DAYS) throw badRequest(`Ask for at most ${MAX_IMPORT_DAYS} days at a time`);

  const [docs, last] = await Promise.all([healthDocsInRange(user.id, from, to), lastHealthWrite(user.id)]);
  return json(
    {
      from,
      to,
      days: mergeHealthDays(docs),
      sources: summariseSources(docs),
      last_sync: last?.at ?? null,
      last_sync_source: last?.source ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
