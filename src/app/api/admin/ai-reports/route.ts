import { z } from "zod";
import { aiReports, toAdminRow } from "@/lib/ai-reports";
import { requireAdmin } from "@/lib/auth";
import { col, type Filter } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(["open", "reviewed", "all"], { errorMap: () => ({ message: "Status must be open, reviewed or all" }) }).default("all"),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const BY_STATUS: Record<z.infer<typeof Query>["status"], Filter> = {
  open: { reviewed: false },
  reviewed: { reviewed: true },
  all: {},
};

/**
 * GET /api/admin/ai-reports?status=open|reviewed|all&limit= (admin only) → {reports, open}
 * Members' reports of AI output, newest first by their latest change (a changed report comes back to the top), each with
 * the reported text and the member's name and email read from `users`. `open` = how many wait for review.
 */
export const GET = route(async (req: Request) => {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const { status, limit } = Query.parse({ status: params.get("status") ?? undefined, limit: params.get("limit") ?? undefined });

  const [rows, open] = await Promise.all([
    aiReports().find(BY_STATUS[status], { sort: { updated_at: -1 }, limit }),
    aiReports().countDocuments({ reviewed: false }),
  ]);
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const members = ids.length ? await col<User>("users").find({ id: { $in: ids } }) : [];
  const byId = new Map(members.map((u) => [u.id, u]));

  return json({ reports: rows.map((r) => toAdminRow(r, byId.get(r.user_id))), open }, { headers: { "Cache-Control": "no-store" } });
});
