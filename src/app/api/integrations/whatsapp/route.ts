import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { badRequest, json, parseBody, route } from "@/lib/http";
import { integrationsView, siteOrigin, updateIntegrations } from "@/lib/care/integrations";
import { E164_RE } from "@/components/care/reminders/shared";

export const dynamic = "force-dynamic";

const body = z.object({
  /** E.164, e.g. "+919876543210". Empty / null removes the number (and the consent). */
  phone: z.string().trim().max(20).nullable().optional(),
  opt_in: z.boolean(),
});

/** PUT /api/integrations/whatsapp {phone (E.164) | null, opt_in} → same shape as GET /api/integrations */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const { phone, opt_in } = await parseBody(req, body);

  if (!phone) {
    if (opt_in) throw badRequest("Add your WhatsApp number to turn on WhatsApp reminders.");
    const updated = await updateIntegrations(user.id, {}, ["whatsapp_phone", "whatsapp_opt_in"]);
    return json(await integrationsView(updated, siteOrigin(req)));
  }

  if (!E164_RE.test(phone)) throw badRequest("Enter the number in international format, like +919876543210.");
  if (phone.startsWith("+91") && !/^\+91[6-9]\d{9}$/.test(phone)) {
    throw badRequest("Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9.");
  }
  const updated = await updateIntegrations(user.id, { whatsapp_phone: phone, whatsapp_opt_in: opt_in });
  return json(await integrationsView(updated, siteOrigin(req)));
});
