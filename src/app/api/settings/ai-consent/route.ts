import { z } from "zod";
import { AI_CONSENT_VERSION } from "@/lib/ai-consent";
import { requireUser, toPublicUser } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { HttpError, json, parseBody, route } from "@/lib/http";
import type { AiConsent, User } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({
  version: z
    .number({ required_error: "Consent version is required", invalid_type_error: "Consent version must be a number" })
    .int("Consent version must be a whole number")
    .min(1, "Consent version must be between 1 and 1000")
    .max(1000, "Consent version must be between 1 and 1000"),
});

/**
 * PUT /api/settings/ai-consent {version} → {user}. The member allows ÖRZA's AI features (OpenAI) as described by the
 * consent copy `version` (see src/lib/ai-consent.ts). Stores `ai_consent = {version, at: now}`; allowing again
 * refreshes `at`. 409 `ai_consent_outdated` when that copy is older than the server's `AI_CONSENT_VERSION` (the app
 * needs an update, or the web page a reload). Cookie or Bearer. Separate from `preferences.ai_training_opt_out`:
 * neither changes the other.
 */
export const PUT = route(async (req: Request) => {
  const user = await requireUser();
  const { version } = await parseBody(req, Body);
  if (version < AI_CONSENT_VERSION) {
    throw new HttpError(409, "This version of the app can't turn on AI features. Please update ÖRZA.", "ai_consent_outdated");
  }

  const at = nowISO();
  const ai_consent: AiConsent = { version, at };
  const updated = await col<User>("users").findOneAndUpdate({ id: user.id }, { $set: { ai_consent, updated_at: at } });
  return json({ user: toPublicUser(updated ?? { ...user, ai_consent }) });
});

/**
 * DELETE /api/settings/ai-consent → {user} with `ai_consent: null`. Idempotent. AI requests from the website and the
 * app are then refused (R1) and the coach's AI prompt leaves out tracked data again (R2); meals, chats, plans and steps stay.
 */
export const DELETE = route(async () => {
  const user = await requireUser();
  const updated = await col<User>("users").findOneAndUpdate(
    { id: user.id },
    { $unset: { ai_consent: "" }, $set: { updated_at: nowISO() } }
  );
  return json({ user: toPublicUser(updated ?? { ...user, ai_consent: null }) });
});
