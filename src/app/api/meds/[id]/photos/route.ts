import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { badRequest, BODY_LIMIT_UPLOAD, json, notFound, parseBody, route } from "@/lib/http";
import { deleteMedia, saveImage } from "@/lib/media";
import type { Medication, Prescription } from "@/lib/types";
import { imageSchema, MAX_PHOTOS_PER_MEDICINE, medicationToClientFor } from "../../_shared";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/meds/[id]/photos {image} → { medication }.
 * A medicine created from a prescription starts with the prescription photo as a fallback; the
 * first real pill photo replaces it on the alarm (the prescription itself keeps its photo).
 */
export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { image } = await parseBody(req, z.object({ image: imageSchema }), { maxBytes: BODY_LIMIT_UPLOAD });
  const meds = col<Medication>("medications");
  const med = await meds.findOne({ id, user_id: user.id });
  if (!med) throw notFound("Medicine not found");

  let keep = med.photo_ids || [];
  if (med.prescription_id) {
    const rx = await col<Prescription>("prescriptions").findOne({ id: med.prescription_id, user_id: user.id });
    if (rx?.media_id) keep = keep.filter((p) => p !== rx.media_id);
  }
  if (keep.length >= MAX_PHOTOS_PER_MEDICINE) {
    throw badRequest(`A medicine can have up to ${MAX_PHOTOS_PER_MEDICINE} photos. Remove one to add another.`);
  }

  const mediaId = await saveImage(user.id, image, "medicine");
  const updated = await meds.findOneAndUpdate({ id: med.id, user_id: user.id }, { $set: { photo_ids: [...keep, mediaId], updated_at: nowISO() } });
  if (!updated) {
    await deleteMedia(user.id, [mediaId]).catch(() => {});
    throw notFound("Medicine not found");
  }
  return json({ medication: await medicationToClientFor(user.id, updated) });
});
