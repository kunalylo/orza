/**
 * The AI consent version and the "allowed" rule, shared by the server (src/lib/ai-consent.ts) and the website's own
 * consent dialog (src/components/ai). No server-only imports here — this file is bundled into the browser too.
 */
import type { AiConsent } from "@/lib/types";

/**
 * The consent copy the website and the apps show. Bump it here and in the phone app (`AI_CONSENT_VERSION` in
 * src/lib/aiConsent.ts) together when what is sent to the AI changes materially (a new kind of data, provider or
 * purpose): every member is then asked again.
 */
export const AI_CONSENT_VERSION = 1;

/** Whether the account allowed the current consent version (a missing, null or malformed record is no consent). */
export function hasAiConsent(user: { ai_consent?: AiConsent | null }): boolean {
  const version = user.ai_consent?.version;
  return typeof version === "number" && version >= AI_CONSENT_VERSION;
}
