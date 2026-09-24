import { col } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { notFound, route } from "@/lib/http";
import { verifyMediaSignature } from "@/lib/media";
import type { Media } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Serves an uploaded image to its owner, or to holders of a valid signed URL (?exp=&sig=). */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound();
  const url = new URL(req.url);
  const signed = verifyMediaSignature(id, url.searchParams.get("exp"), url.searchParams.get("sig"));
  const userId = signed ? null : await getSessionUserId();
  if (!signed && !userId) throw notFound();
  const media = await col<Media>("media").findOne(signed ? { id } : { id, user_id: userId });
  if (!media) throw notFound();
  return new Response(Buffer.from(media.data, "base64"), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});
