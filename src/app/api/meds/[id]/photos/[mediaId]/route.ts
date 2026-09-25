import { requireUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { json, notFound, route } from "@/lib/http";
import type { Medication } from "@/lib/types";
import { deletePhotosIfUnused, medicationToClientFor } from "../../../_shared";

type Ctx = { params: Promise<{ id: string; mediaId: string }> };

/** DELETE /api/meds/[id]/photos/[mediaId] → { medication }. The image is deleted once nothing else uses it. */
export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id, mediaId } = await ctx.params;
  const meds = col<Medication>("medications");
  const med = await meds.findOne({ id, user_id: user.id });
  if (!med) throw notFound("Medicine not found");
  if (!(med.photo_ids || []).includes(mediaId)) throw notFound("Photo not found");

  const updated = await meds.findOneAndUpdate(
    { id: med.id, user_id: user.id },
    { $set: { photo_ids: med.photo_ids.filter((p) => p !== mediaId), updated_at: nowISO() } }
  );
  if (!updated) throw notFound("Medicine not found");
  await deletePhotosIfUnused(user.id, [mediaId]);
  return json({ medication: await medicationToClientFor(user.id, updated) });
});
