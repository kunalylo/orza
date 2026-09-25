import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { col, newId, nowISO } from "@/lib/db";
import { BODY_LIMIT_UPLOAD, json, parseBody, route } from "@/lib/http";
import { deleteMedia, saveImage } from "@/lib/media";
import { clampText, MAX_PRESCRIPTION_MEDICINES, normaliseMedicines, parseIssuedOn } from "@/lib/care/prescription-ai";
import { compact, imageSchema } from "../meds/_shared";
import { prescriptionToClient, type PrescriptionDoc } from "./_shared";

/** GET /api/prescriptions → { prescriptions } (newest first, each with `photo_url`). */
export const GET = route(async () => {
  const user = await requireUser();
  const list = await col<PrescriptionDoc>("prescriptions").find({ user_id: user.id }, { sort: { created_at: -1 }, limit: 50 });
  return json({ prescriptions: list.map(prescriptionToClient) });
});

const manualSchema = z.object({
  image: imageSchema.optional(),
  doctor: z.string().max(200).optional(),
  issued_on: z.string().max(30).optional(),
  notes: z.string().max(1000).optional(),
  medicines: z.array(z.record(z.unknown())).max(MAX_PRESCRIPTION_MEDICINES).optional(),
});

/**
 * POST /api/prescriptions {image?, doctor?, issued_on?, notes?, medicines?} → { prescription }
 * Manual entry (when AI scanning is off or the user prefers typing): stores the optional photo as
 * media kind "prescription" and creates a prescription in "review", ready for /apply.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, manualSchema, { maxBytes: BODY_LIMIT_UPLOAD });
  const mediaId = body.image ? await saveImage(user.id, body.image, "prescription") : undefined;
  const rx: PrescriptionDoc = compact({
    id: newId(),
    user_id: user.id,
    media_id: mediaId,
    doctor: clampText(body.doctor, 80),
    issued_on: parseIssuedOn(body.issued_on),
    notes: clampText(body.notes, 300),
    medicines: normaliseMedicines(body.medicines || [], { fromUser: true }),
    status: "review" as const,
    created_at: nowISO(),
  });
  try {
    await col<PrescriptionDoc>("prescriptions").insertOne(rx);
  } catch (e) {
    if (mediaId) await deleteMedia(user.id, [mediaId]).catch(() => {});
    throw e;
  }
  return json({ prescription: prescriptionToClient(rx) }, 201);
});
