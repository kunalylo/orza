/**
 * Photo prep for medicine and prescription photos: reuse the shared downscaler (≤1280 px JPEG, EXIF
 * stripped), then make sure the result fits the server's 1.5 MB image limit — detailed shots of
 * handwriting can exceed it — by re-encoding smaller when needed.
 */
import { PhotoError, preparePhoto } from "@/components/meals/image";

export { PhotoError };

/** Server limit is 1,500,000 bytes of image data; stay a little under it. */
const MAX_BYTES = 1_400_000;

const bytesOf = (dataUrl: string) => {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor((b64.length * 3) / 4);
};

function reencode(src: string, maxSide: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new PhotoError("Your browser couldn't process that photo. Please try another browser."));
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new PhotoError("We couldn't read that photo. Please try another."));
    img.src = src;
  });
}

export async function prepareCarePhoto(file: File): Promise<string> {
  if (file.type && !file.type.startsWith("image/")) throw new PhotoError("That file isn't a photo. Please choose an image.");
  let { dataUrl } = await preparePhoto(file);
  const attempts: [number, number][] = [
    [1280, 0.7],
    [1100, 0.65],
    [960, 0.6],
  ];
  for (const [side, q] of attempts) {
    if (bytesOf(dataUrl) <= MAX_BYTES) break;
    dataUrl = await reencode(dataUrl, side, q);
  }
  if (bytesOf(dataUrl) > MAX_BYTES) throw new PhotoError("That photo is too detailed to upload. Please try a closer, simpler shot.");
  return dataUrl;
}
