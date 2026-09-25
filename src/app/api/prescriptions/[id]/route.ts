import { requireUser } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, notFound, route } from "@/lib/http";
import { deletePhotosIfUnused } from "../../meds/_shared";
import { prescriptionToClient, type PrescriptionDoc } from "../_shared";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/prescriptions/[id] → { prescription } */
export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const rx = await col<PrescriptionDoc>("prescriptions").findOne({ id, user_id: user.id });
  if (!rx) throw notFound("Prescription not found");
  return json({ prescription: prescriptionToClient(rx) });
});

/**
 * DELETE /api/prescriptions/[id] → { ok }. Medicines already created from it keep working; the photo
 * is deleted only when no medicine still shows it as its fallback photo.
 */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const rxs = col<PrescriptionDoc>("prescriptions");
  const rx = await rxs.findOne({ id, user_id: user.id });
  if (!rx) throw notFound("Prescription not found");
  await rxs.deleteOne({ id: rx.id, user_id: user.id });
  if (rx.media_id) await deletePhotosIfUnused(user.id, [rx.media_id]);
  return json({ ok: true });
});
