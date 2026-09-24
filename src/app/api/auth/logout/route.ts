import { endSession } from "@/lib/auth";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout → {ok:true}. Always succeeds (clears the cookie even if already signed out). */
export const POST = route(async () => {
  await endSession();
  return json({ ok: true });
});
