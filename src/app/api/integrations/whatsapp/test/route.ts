import { col } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, badRequest, json, route } from "@/lib/http";
import { mediaUrl } from "@/lib/media";
import { cooldownSeconds } from "@/lib/care/integrations";
import { WhatsAppError, publicUrl, sendWhatsApp, whatsappConfigured, whatsappMode } from "@/lib/care/whatsapp";
import { medicineLabel } from "@/components/care/reminders/shared";
import type { Medication } from "@/lib/types";

export const dynamic = "force-dynamic";

/** POST /api/integrations/whatsapp/test → {ok, mode, image} — sends a sample message to the saved number. */
export const POST = route(async () => {
  const user = await requireUser();
  if (!whatsappConfigured()) {
    throw new HttpError(503, "WhatsApp messages aren't available right now.", "whatsapp_not_configured");
  }
  const phone = user.integrations?.whatsapp_phone;
  if (!phone) throw badRequest("Save your WhatsApp number first.");
  if (!user.integrations?.whatsapp_opt_in) throw badRequest("Turn on WhatsApp reminders (and agree to receive them) before sending a test.");

  const wait = cooldownSeconds(`wa-test:${user.id}`, 30_000);
  if (wait) throw new HttpError(429, `Please wait ${wait} s before sending another test.`, "rate_limited");

  const meds = await col<Medication>("medications").find({ user_id: user.id, active: true }, { sort: { created_at: 1 } });
  const med = meds.find((m) => m.photo_ids?.length);
  const imageUrl = med ? publicUrl(mediaUrl(med.photo_ids[0], 86_400)) || undefined : undefined;

  try {
    const r = await sendWhatsApp(phone, {
      title: "ÖRZA test message",
      body: med
        ? `WhatsApp reminders are working. Medicine alarms will look like this, with the photo of ${medicineLabel(med)}.`
        : "WhatsApp reminders are working. Medicine alarms and the reminders you switch to WhatsApp will arrive here.",
      imageUrl,
      imageCaption: med ? medicineLabel(med) : undefined,
      link: publicUrl("/dashboard/reminders") || undefined,
    });
    return json({ ok: true, mode: r.mode, image: r.image, session_only: whatsappMode() === "session" });
  } catch (e) {
    if (e instanceof WhatsAppError) throw new HttpError(502, e.message, "whatsapp_failed");
    throw e;
  }
});
