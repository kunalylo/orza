import { z } from "zod";
import { endSession } from "@/lib/auth";
import { BODY_LIMIT_SMALL, badRequest, json, readBodyText, route } from "@/lib/http";
import { assertSameOriginJson } from "../_lib";

export const dynamic = "force-dynamic";

const Body = z.object({ everywhere: z.boolean().optional() }).strip();

/**
 * POST /api/auth/logout {everywhere?} → {ok:true}. Always succeeds for ÖRZA's own pages (clears the
 * cookie even if already signed out); cross-site form posts are refused so other sites can't sign
 * people out. `everywhere: true` also revokes every other session of the account (all devices).
 */
export const POST = route(async (req: Request) => {
  assertSameOriginJson(req);
  const raw = await readBodyText(req, { maxBytes: BODY_LIMIT_SMALL });
  let data: unknown = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw badRequest("Request body must be valid JSON");
    }
  }
  const { everywhere } = Body.parse(data ?? {});
  await endSession({ everywhere: everywhere === true });
  return json({ ok: true });
});
