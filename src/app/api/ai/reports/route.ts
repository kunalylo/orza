import { z } from "zod";
import { isAppRequest } from "@/lib/ai-consent";
import { AI_REPORT_KINDS, AI_REPORT_NOTE_MAX, AI_REPORT_REASONS } from "@/lib/ai-report-shared";
import { AI_REPORTED_ITEMS_PER_DAY, AI_REPORTS_PER_MINUTE, aiReports, loadReported, saveReport, toOwnView } from "@/lib/ai-reports";
import { getCurrentSession } from "@/lib/auth";
import { BODY_LIMIT_SMALL, json, notFound, parseBody, route, unauthorized } from "@/lib/http";
import { ONE_MINUTE, reserve, tooManyRequests } from "@/lib/rate-limit";
import { CLIENT_HEADER } from "@/lib/session-token";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTE_TOO_LONG = `Keep the note under ${AI_REPORT_NOTE_MAX} characters`;

const Body = z.object({
  kind: z.enum(AI_REPORT_KINDS, { errorMap: () => ({ message: "Choose what you're reporting" }) }),
  ref_id: z
    .string({ required_error: "ref_id is required", invalid_type_error: "ref_id must be a string" })
    .trim()
    .min(1, "ref_id is required")
    .max(100, "ref_id looks invalid"),
  reason: z.enum(AI_REPORT_REASONS, { errorMap: () => ({ message: "Choose a reason" }) }),
  note: z
    .string({ invalid_type_error: "Note must be text" })
    .max(AI_REPORT_NOTE_MAX + 200, NOTE_TOO_LONG)
    .transform((s) => s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().max(AI_REPORT_NOTE_MAX, NOTE_TOO_LONG))
    .nullish(),
});

/**
 * POST /api/ai/reports {kind, ref_id, reason, note?} → 201 {report} (first report) | 200 {report} (replaced the member's
 * earlier report of that item, which goes back to review).
 * Reports an AI output the member was shown (src/lib/ai-reports.ts): only their own item, else 404. Needs no AI consent
 * (nothing goes to the AI). 429 `rate_limited` after AI_REPORTS_PER_MINUTE reports in a minute or
 * AI_REPORTED_ITEMS_PER_DAY other items in 24 hours.
 */
export const POST = route(async (req: Request) => {
  const current = await getCurrentSession();
  if (!current) throw unauthorized();
  const { user } = current;

  const wait = reserve([{ key: `ai-report:${user.id}`, limit: AI_REPORTS_PER_MINUTE, windowMs: ONE_MINUTE }]);
  if (wait) return tooManyRequests(wait, "You've sent several reports in a row.");

  const body = await parseBody(req, Body, { maxBytes: BODY_LIMIT_SMALL });
  const item = await loadReported(user.id, body.kind, body.ref_id);
  if (!item) throw notFound("We couldn't find that to report. It may have been deleted.");

  // Changing a report that is already counted is always allowed; only new items count toward the day.
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const [recent, earlier] = await Promise.all([
    aiReports().countDocuments({ user_id: user.id, updated_at: { $gte: since } }),
    aiReports().findOne({ user_id: user.id, kind: body.kind, ref_id: body.ref_id }),
  ]);
  const others = recent - (earlier && earlier.updated_at >= since ? 1 : 0);
  if (others >= AI_REPORTED_ITEMS_PER_DAY) {
    return json(
      { error: "You've sent a lot of reports today. Thank you, the team will look at them.", code: "rate_limited" },
      { status: 429 }
    );
  }

  const { report, created } = await saveReport({
    userId: user.id,
    kind: body.kind,
    refId: body.ref_id,
    reason: body.reason,
    note: body.note || null,
    client: isAppRequest(current.via, current.session, req.headers.get(CLIENT_HEADER)) ? "app" : "web",
    item,
  });
  console.info("[orza] ai report", { user_id: user.id, report_id: report.id, kind: report.kind, reason: report.reason, created });

  return json({ report: toOwnView(report) }, { status: created ? 201 : 200 });
});
