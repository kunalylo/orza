import { requireUser } from "@/lib/auth";
import { tzOf } from "@/lib/care/meds";
import { json, route } from "@/lib/http";
import type { CalendarStatusResponse } from "@/components/care/calendar/types";
import { externalState } from "./_lib/external";
import { feedLinks, isLocalBaseUrl, publicBaseUrl } from "./_lib/feed";

export const dynamic = "force-dynamic";

/** GET /api/calendar → subscription feed links (if created) + external calendar connection state. */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const base = publicBaseUrl(req);
  const token = user.integrations?.calendar_token;
  const body: CalendarStatusResponse = {
    tz: tzOf(user),
    feed: token ? feedLinks(token, base) : null,
    is_local: isLocalBaseUrl(base),
    external: externalState(user),
  };
  return json(body, { headers: { "Cache-Control": "no-store" } });
});
