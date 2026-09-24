/**
 * Client-side photo prep for Snap & Know: decode any browser-readable image, downscale so the
 * longest side is ≤ 1280 px and re-encode as JPEG. Keeps uploads small (~150–400 KB) and fast
 * on mobile data, strips EXIF metadata (location etc.) and normalises HEIC/PNG/WEBP to JPEG.
 */

export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.82;
/** Originals above this are refused before decoding (protects low-memory phones). */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
/** Mirrors the API limit (~6 MB of image data once base64-encoded). */
const MAX_DATA_URL_CHARS = 8_500_000;

export class PhotoError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PhotoError("We couldn't read that photo. Please try a JPEG or PNG — or take a new one."));
    };
    img.src = url;
  });
}

export async function preparePhoto(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  if (file.type && !file.type.startsWith("image/")) throw new PhotoError("That file isn't a photo. Please choose an image of your meal.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new PhotoError("That photo is very large. Please choose one under 25 MB.");

  const img = await loadImage(file);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (!w0 || !h0) throw new PhotoError("That photo looks empty. Please try another.");

  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("Your browser couldn't process that photo. Please try another browser.");
  // White base so transparent PNGs don't turn black as JPEG.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height); // modern browsers apply EXIF orientation here

  let quality = JPEG_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.4) {
    quality -= 0.15;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (!dataUrl.startsWith("data:image/jpeg")) throw new PhotoError("Your browser couldn't convert that photo. Please try another.");
  return { dataUrl, width, height };
}
