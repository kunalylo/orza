import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { nowISO } from "@/lib/db";
import { badRequest, json, notFound, parseBody, route } from "@/lib/http";
import { CREDIT_REQUEST_TYPE, creditRequests } from "../../../credits/requests";

export const dynamic = "force-dynamic";

const Body = z.object({
  status: z.enum(["open", "done"], { errorMap: () => ({ message: "Status must be open or done" }) }),
});

/**
 * PATCH /api/admin/credit-requests/[id] {status} (admin only) → {ok:true}
 * Marks a credit request as handled (e.g. answered by email without a top-up) or reopens it.
 * Granting credits from the admin panel closes the member's open requests automatically.
 */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!id || id.length > 100) throw badRequest("Invalid request id");
  const { status } = await parseBody(req, Body);

  const now = nowISO();
  const update =
    status === "done"
      ? { $set: { status, handled_at: now, handled_by: admin.id, updated_at: now } }
      : { $set: { status, updated_at: now }, $unset: { handled_at: "", handled_by: "" } };
  const { matched } = await creditRequests().updateOne({ id, type: CREDIT_REQUEST_TYPE }, update);
  if (!matched) throw notFound("Credit request not found");

  return json({ ok: true });
});
