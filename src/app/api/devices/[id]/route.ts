import { requireUser } from "@/lib/auth";
import { appDevices } from "@/lib/devices";
import { json, notFound, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/devices/[id] → {ok:true} (404 when it isn't one of the user's phones).
 * Unregisters a phone (the app does this when it stops ringing alarms itself), so medicine doses go
 * back to Web Push. It doesn't sign the app out — that's POST /api/auth/logout with the app's token.
 */
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("Device not found");
  const removed = await appDevices().deleteOne({ id, user_id: user.id });
  if (!removed) throw notFound("Device not found");
  return json({ ok: true });
});
