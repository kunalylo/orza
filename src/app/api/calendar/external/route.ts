import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { clearExternalCache, expandEvents, loadExternalCalendar, normalizeCalendarUrl } from "@/lib/care/ical-import";
import { tzOf } from "@/lib/care/meds";
import { json, parseBody, route, BODY_LIMIT_SMALL } from "@/lib/http";
import type { User } from "@/lib/types";
import type { ExternalConnectResponse } from "@/components/care/calendar/types";
import { checkConnectRate, externalState, importErrorToHttp } from "../_lib/external";

export const dynamic = "force-dynamic";

const Body = z.object({ url: z.string().trim().min(1, "Paste your calendar's iCal (ICS) address.").max(2048, "That link is too long to be a calendar address.") });

/**
 * PUT /api/calendar/external {url} — connect the user's own calendar (read-only).
 * Accepts https:// and webcal:// (rewritten to https://). The link is fetched once, through the
 * SSRF-guarded importer, to prove it returns a calendar before it is saved.
 */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const { url } = await parseBody(req, Body, { maxBytes: BODY_LIMIT_SMALL });

  let normalized: string;
  try {
    normalized = normalizeCalendarUrl(url).href;
  } catch (e) {
    throw importErrorToHttp(e);
  }
  checkConnectRate(user.id);

  const now = new Date();
  let upcoming = 0;
  let name: string | undefined;
  try {
    clearExternalCache(user.id);
    const cal = await loadExternalCalendar(normalized, { userId: user.id, fresh: true });
    name = cal.name;
    upcoming = expandEvents(cal, now, new Date(now.getTime() + 30 * 86400000), tzOf(user)).length;
  } catch (e) {
    clearExternalCache(user.id);
    throw importErrorToHttp(e);
  }

  await col<User>("users").updateOne({ id: user.id }, { $set: { "integrations.external_ical_url": normalized, updated_at: nowISO() } });
  const body: ExternalConnectResponse = {
    external: externalState({ integrations: { ...(user.integrations || {}), external_ical_url: normalized } }, { name }),
    upcoming_count: upcoming,
  };
  return json(body);
});

/** DELETE /api/calendar/external — disconnect the external calendar → {ok}. */
export const DELETE = route(async () => {
  const user = await requireUser();
  await col<User>("users").updateOne({ id: user.id }, { $unset: { "integrations.external_ical_url": "" }, $set: { updated_at: nowISO() } });
  clearExternalCache(user.id);
  return json({ ok: true });
});
