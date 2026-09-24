import { endSession } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { assertSameOriginJson } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout → {ok:true}. Always succeeds for ÖRZA's own pages (clears the cookie even if
 * already signed out); cross-site form posts are refused so other sites can't sign people out.
 */
export const POST = route(async (req: Request) => {
  assertSameOriginJson(req);
  await endSession();
  return json({ ok: true });
});
