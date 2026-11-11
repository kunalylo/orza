import { z } from "zod";
import { aiReports } from "@/lib/ai-reports";
import { requireAdmin } from "@/lib/auth";
import { nowISO } from "@/lib/db";
import { badRequest, json, notFound, parseBody, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const Body = z.object({
  reviewed: z.boolean({ required_error: "reviewed is required", invalid_type_error: "reviewed must be true or false" }),
});

/**
 * PATCH /api/admin/ai-reports/[id] {reviewed} (admin only) → {ok:true}
 * Ticks a report as reviewed (records when and by whom) or puts it back to review. A new report from the member puts it
 * back to review too.
 */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!id || id.length > 100) throw badRequest("Invalid report id");
  const { reviewed } = await parseBody(req, Body);

  const update = reviewed
    ? { $set: { reviewed: true, reviewed_at: nowISO(), reviewed_by: admin.id } }
    : { $set: { reviewed: false }, $unset: { reviewed_at: "", reviewed_by: "" } };
  const { matched } = await aiReports().updateOne({ id }, update);
  if (!matched) throw notFound("Report not found");

  return json({ ok: true });
});
