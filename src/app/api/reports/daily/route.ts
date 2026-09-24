import { requireUser } from "@/lib/auth";
import { dateInTz } from "@/lib/dates";
import { badRequest, json, route } from "@/lib/http";
import { buildDailyReport, isRealDate } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/daily?date=YYYY-MM-DD — totals vs targets, day score, highlights and gentle suggestions. */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const today = dateInTz(user.profile?.timezone);
  const raw = new URL(req.url).searchParams.get("date");
  if (raw && !isRealDate(raw)) throw badRequest("date must be a valid YYYY-MM-DD date");
  return json(await buildDailyReport(user, raw || today, today));
});
