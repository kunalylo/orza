import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { aiRateLimited, reserveAi } from "@/lib/ai-guard";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { BODY_LIMIT_UPLOAD, HttpError, json, parseBody, route } from "@/lib/http";
import { deleteMedia, saveImage } from "@/lib/media";
import { aiScanPrescription, type PrescriptionScan } from "@/lib/care/prescription-ai";
import type { User } from "@/lib/types";
import { compact, imageSchema } from "../../meds/_shared";
import { prescriptionToClient, type PrescriptionDoc } from "../_shared";

/** Room for the AI's own timeout (vision AI ≤ 60 s + saving the prescription) so a slow answer still reaches the fallback instead of a platform 504. */
export const maxDuration = 90;

/**
 * POST /api/prescriptions/scan {image: dataUrl} → { prescription, credits }
 * Reads the prescription with AI vision (2 credits, refunded if the AI fails), stores the photo as
 * media kind "prescription" and saves the medicines for review (status "review").
 * AI off → 503 `ai_disabled`; the page then offers manual entry. 429 `rate_limited` when photos are
 * scanned faster than the per-user budget shared with meal scans.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { image } = await parseBody(req, z.object({ image: imageSchema }), { maxBytes: BODY_LIMIT_UPLOAD });
  if (!aiEnabled()) {
    throw new HttpError(503, "Prescription scanning isn't switched on yet. You can type the medicines from your prescription instead.", "ai_disabled");
  }

  // Same per-user photo-scan budget as Snap & Know (see @/lib/ai-guard).
  const release = await reserveAi(user.id, "scan");
  if (!release) throw aiRateLimited();
  let mediaId: string;
  let scan: PrescriptionScan;
  try {
    // Validates type + size before any credits are spent.
    mediaId = await saveImage(user.id, image, "prescription");
    try {
      scan = await withCredits(user.id, "scan", () => aiScanPrescription(image, user.profile), "Prescription scan");
    } catch (e) {
      await deleteMedia(user.id, [mediaId]).catch(() => {});
      throw e;
    }
  } finally {
    release();
  }

  const rx: PrescriptionDoc = compact({
    id: newId(),
    user_id: user.id,
    media_id: mediaId,
    doctor: scan.doctor,
    issued_on: scan.issued_on,
    patient_name: scan.patient_name,
    notes: scan.notes,
    medicines: scan.medicines,
    status: "review" as const,
    created_at: nowISO(),
  });
  await col<PrescriptionDoc>("prescriptions").insertOne(rx);
  const fresh = await col<User>("users").findOne({ id: user.id });
  return json({ prescription: prescriptionToClient(rx), credits: fresh?.credits ?? user.credits });
});
