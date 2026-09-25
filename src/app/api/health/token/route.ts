import { requireUser } from "@/lib/auth";
import { createHealthToken, healthTokenStatus, revokeHealthToken } from "@/lib/care/health";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

const noStore = { headers: { "Cache-Control": "no-store" } };

/** GET /api/health/token → `{token: {preview, created_at} | null}` — status only; the token itself is never readable again. */
export const GET = route(async () => {
  const user = await requireUser();
  return json({ token: healthTokenStatus(user) }, noStore);
});

/**
 * POST /api/health/token → `{token, preview, created_at}`. Creates the personal sync token, or rotates it
 * (the previous token stops working immediately). The plaintext is returned only in this response.
 */
export const POST = route(async () => {
  const user = await requireUser();
  const created = await createHealthToken(user.id);
  return json(created, noStore);
});

/** DELETE /api/health/token → `{ok}` — revokes the sync token; automations using it get 401 from then on. */
export const DELETE = route(async () => {
  const user = await requireUser();
  await revokeHealthToken(user.id);
  return json({ ok: true }, noStore);
});
