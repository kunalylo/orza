import { col } from "@/lib/db";
import { notFound, route } from "@/lib/http";
import type { User } from "@/lib/types";
import { buildUserFeed, CALENDAR_TOKEN_RE, publicBaseUrl } from "../../_lib/feed";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/feed/[token] — public, unauthenticated ICS feed that Google / Apple / Outlook
 * calendars subscribe to. The unguessable token (on `users.integrations.calendar_token`) is the only
 * credential; unknown or revoked tokens get 404. A trailing ".ics" is accepted for clients that want one.
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ token: string }> }) => {
  const { token: raw } = await ctx.params;
  let token = "";
  try {
    token = decodeURIComponent(raw || "").replace(/\.ics$/i, "");
  } catch {
    throw notFound("Calendar not found");
  }
  if (!CALENDAR_TOKEN_RE.test(token)) throw notFound("Calendar not found");

  const user = await col<User>("users").findOne({ "integrations.calendar_token": token });
  if (!user || user.integrations?.calendar_token !== token) throw notFound("Calendar not found");

  const ics = await buildUserFeed(user, publicBaseUrl(req));
  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="orza-care.ics"',
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
});
