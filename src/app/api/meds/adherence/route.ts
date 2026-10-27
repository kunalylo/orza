import { requireUser } from "@/lib/auth";
import { addDays, dateInTz, dateRange, zonedToUtc } from "@/lib/dates";
import { col } from "@/lib/db";
import { badRequest, json, route } from "@/lib/http";
import { doseHistoryBetween, tzOf, type DoseView } from "@/lib/care/meds";
import { mediaUrl } from "@/lib/media";
import type { Medication } from "@/lib/types";

type Tally = { scheduled: number; taken: number; skipped: number; missed: number; pending: number; upcoming: number; total: number };

const empty = (): Tally => ({ scheduled: 0, taken: 0, skipped: 0, missed: 0, pending: 0, upcoming: 0, total: 0 });

function add(t: Tally, d: DoseView) {
  t.scheduled++;
  if (d.status === "taken") t.taken++;
  else if (d.status === "skipped") t.skipped++;
  else if (d.status === "missed") t.missed++;
  else if (d.status === "upcoming") t.upcoming++;
  else t.pending++; // due / snoozed
  // "total" = doses whose time has come (or that were already acted on early) — the adherence denominator.
  if (d.status !== "upcoming") t.total++;
}

const rate = (t: Tally) => (t.total ? Math.round((t.taken / t.total) * 100) / 100 : null);

/**
 * GET /api/meds/adherence?days=7|30 → { days, from, to, overall, daily: [...], medicines: [...] }
 * Per local day and per medicine (active or paused, with a dose in the range): scheduled, taken, skipped, missed,
 * pending (due/snoozed), upcoming, total (= doses whose time has come) and rate (taken / total, null when nothing
 * was due). Past days keep what was due then — the schedule of the time (`doseHistoryBetween`) plus every recorded
 * Take / Skip / Snooze — so editing a medicine's times or pausing it doesn't rewrite them.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams.get("days") || "7";
  if (q !== "7" && q !== "30") throw badRequest("days must be 7 or 30");
  const days = Number(q);

  const tz = tzOf(user);
  const today = dateInTz(tz);
  const from = addDays(today, -(days - 1));
  const now = new Date();
  const meds = await col<Medication>("medications").find({ user_id: user.id }, { sort: { created_at: 1 }, limit: 500 });
  const doses = await doseHistoryBetween(user, zonedToUtc(from, "00:00", tz), zonedToUtc(addDays(today, 1), "00:00", tz), now, meds);

  const byDay = new Map(dateRange(from, days).map((d) => [d, empty()]));
  const byMed = new Map<string, Tally>();
  const overall = empty();
  for (const d of doses) {
    const day = byDay.get(d.local_date);
    if (!day) continue;
    add(day, d);
    add(overall, d);
    if (!byMed.has(d.medication_id)) byMed.set(d.medication_id, empty());
    add(byMed.get(d.medication_id)!, d);
  }

  return json({
    days,
    from,
    to: today,
    overall: { ...overall, rate: rate(overall) },
    daily: [...byDay.entries()].map(([date, t]) => ({ date, ...t, rate: rate(t) })),
    medicines: meds
      .filter((m) => byMed.has(m.id))
      .map((m) => {
        const t = byMed.get(m.id)!;
        return {
          medication_id: m.id,
          name: m.name,
          strength: m.strength,
          for_person: m.for_person,
          photo_url: m.photo_ids?.[0] ? mediaUrl(m.photo_ids[0]) : null,
          ...t,
          rate: rate(t),
        };
      })
      .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1) || a.name.localeCompare(b.name)),
  });
});
