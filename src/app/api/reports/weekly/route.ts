import { requireUser } from "@/lib/auth";
import { dateInTz } from "@/lib/dates";
import { badRequest, json, route } from "@/lib/http";
import { buildWeeklyReport, isRealDate } from "@/lib/reports";

export const dynamic = "force-dynamic";

/** GET /api/reports/weekly?end=YYYY-MM-DD — the 7 days ending on `end` (default: the user's today). */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const raw = new URL(req.url).searchParams.get("end");
  if (raw && !isRealDate(raw)) throw badRequest("end must be a valid YYYY-MM-DD date");
  return json(await buildWeeklyReport(user, raw || dateInTz(user.profile?.timezone)));
});
