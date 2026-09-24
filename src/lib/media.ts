/**
 * Image storage for medicine photos and prescriptions (base64 in the `media` collection).
 * Clients must downscale before upload (≤1600px JPEG/WebP); the server enforces type + size.
 * Images are served by /api/media/[id] to their owner, or to anyone holding a short-lived
 * signed URL (needed for push-notification images, which the browser fetches without our UI).
 */
import { createHmac, timingSafeEqual } from "crypto";
import { col, newId, nowISO } from "@/lib/db";
import { badRequest } from "@/lib/http";
import type { Media } from "@/lib/types";

export const MAX_IMAGE_BYTES = 1_500_000; // after client-side compression
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

function signingKey() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set in production");
    return "orza-dev-only-secret-change-me-in-production-please";
  }
  return s;
}

/** Validate a data URL and store it. Returns the new Media id. */
export async function saveImage(userId: string, dataUrl: string, kind: Media["kind"]): Promise<string> {
  const m = DATA_URL.exec(dataUrl || "");
  if (!m) throw badRequest("Please upload a JPEG, PNG or WebP image.");
  const data = m[2];
  const bytes = Math.floor((data.length * 3) / 4) - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0);
  if (bytes > MAX_IMAGE_BYTES) throw badRequest("That photo is too large. Please use a smaller image (max 1.5 MB).");
  const doc: Media = { id: newId(), user_id: userId, kind, mime: m[1] as Media["mime"], data, bytes, created_at: nowISO() };
  await col<Media>("media").insertOne(doc);
  return doc.id;
}

export async function getOwnedMedia(userId: string, id: string): Promise<Media | null> {
  return col<Media>("media").findOne({ id, user_id: userId });
}

export async function deleteMedia(userId: string, ids: string[]) {
  for (const id of ids) await col<Media>("media").deleteOne({ id, user_id: userId });
}

function sign(id: string, exp: number) {
  return createHmac("sha256", signingKey()).update(`${id}.${exp}`).digest("base64url");
}

/** Relative URL for an image. With `signedForSeconds`, anyone with the link can view it until it expires. */
export function mediaUrl(id: string, signedForSeconds?: number): string {
  if (!signedForSeconds) return `/api/media/${id}`;
  const exp = Math.floor(Date.now() / 1000) + signedForSeconds;
  return `/api/media/${id}?exp=${exp}&sig=${sign(id, exp)}`;
}

export function verifyMediaSignature(id: string, exp: string | null, sig: string | null): boolean {
  if (!exp || !sig) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(sign(id, e));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}
