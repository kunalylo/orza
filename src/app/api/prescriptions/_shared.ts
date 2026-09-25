import { mediaUrl } from "@/lib/media";
import type { Prescription } from "@/lib/types";

/** Stored prescription (the scan also keeps the patient's name when it was written). */
export type PrescriptionDoc = Prescription & { patient_name?: string; applied_at?: string };

export function prescriptionToClient(p: PrescriptionDoc) {
  return { ...p, photo_url: p.media_id ? mediaUrl(p.media_id) : null };
}
