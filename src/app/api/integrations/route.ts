import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { integrationsView, siteOrigin } from "@/lib/care/integrations";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations → {push:{configured, subscriptions, public_key}, whatsapp:{configured, mode, phone, opt_in},
 * calendar:{feed_url, external_url_set}, health:{token_preview, last_sync}, quiet_hours, reminders_enabled, timezone}
 * No secrets are returned (health / calendar tokens are never echoed except the feed URL the owner created).
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  return json(await integrationsView(user, siteOrigin(req)), { headers: { "Cache-Control": "no-store" } });
});
