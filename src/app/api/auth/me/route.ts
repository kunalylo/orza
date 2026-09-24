import { requireUser, toPublicUser } from "@/lib/auth";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/auth/me → {user} | 401. */
export const GET = route(async () => {
  const user = await requireUser();
  return json({ user: toPublicUser(user) }, { headers: { "Cache-Control": "no-store" } });
});
