import { requireUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { User } from "@/lib/types";
import type { CalendarTokenResponse } from "@/components/care/calendar/types";
import { feedLinks, isLocalBaseUrl, newCalendarToken, publicBaseUrl } from "../_lib/feed";

export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/token → create (or rotate) the private feed address → {feed_url, webcal_url, is_local}.
 * Rotating immediately stops the old address from working in every calendar that subscribed to it.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const token = newCalendarToken();
  await col<User>("users").updateOne({ id: user.id }, { $set: { "integrations.calendar_token": token, updated_at: nowISO() } });
  const base = publicBaseUrl(req);
  const body: CalendarTokenResponse = { ...feedLinks(token, base), is_local: isLocalBaseUrl(base) };
  return json(body, { headers: { "Cache-Control": "no-store" } });
});

/** DELETE /api/calendar/token → revoke the feed address (subscribed calendars stop updating) → {ok}. */
export const DELETE = route(async () => {
  const user = await requireUser();
  await col<User>("users").updateOne({ id: user.id }, { $unset: { "integrations.calendar_token": "" }, $set: { updated_at: nowISO() } });
  return json({ ok: true });
});
