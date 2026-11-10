/**
 * AI consent: the member's permission for ÖRZA's AI features, which OpenAI runs (App Store 5.1.2(i), Google Play
 * User Data policy). One record per account, `users.ai_consent = {version, at}` (absent or null = none), set and
 * withdrawn with PUT / DELETE /api/settings/ai-consent and sent in every `{user}` answer (`toPublicUser`, null when none).
 *
 * - R1, the phone app: the six routes that call the AI (chat/send, meals/text, meals/scan, recipes/generate,
 *   compensation/plan, prescriptions/scan) start with `requireAiUser()`. It refuses an app request from an account
 *   without consent with 403 `ai_consent_required` before the body is read, credits move, a photo is stored or
 *   `aiEnabled()` is asked. The website's cookie requests are never refused (the website doesn't ask yet).
 * - R2, any client: for an account without consent, Ask ÖRZA's AI prompt leaves out today's tracked steps and the
 *   replies that can quote tracked steps or weight (`contextForPrompt` and `aiHistory` in src/lib/coach.ts).
 */
import { headers } from "next/headers";
import { getCurrentSession, type SessionVia } from "@/lib/auth";
import { HttpError, unauthorized } from "@/lib/http";
import { CLIENT_HEADER } from "@/lib/session-token";
import type { Session, User } from "@/lib/types";

/**
 * The consent copy the apps show. Bump it here and in the phone app (`AI_CONSENT_VERSION` in src/lib/aiConsent.ts)
 * together when what is sent to the AI changes materially (a new kind of data, provider or purpose): every member is
 * then asked again.
 */
export const AI_CONSENT_VERSION = 1;

/** Whether the account allowed the current consent version (a missing, null or malformed record is no consent). */
export function hasAiConsent(user: Pick<User, "ai_consent">): boolean {
  const version = user.ai_consent?.version;
  return typeof version === "number" && version >= AI_CONSENT_VERSION;
}

/**
 * Whether a request comes from the ÖRZA phone app: signed in with an app session's Bearer token (kind "mobile"), or
 * sending `X-ORZA-Client: mobile`. Pure.
 */
export function isAppRequest(via: SessionVia, session: Pick<Session, "kind">, clientHeader: string | null | undefined): boolean {
  if (via === "bearer" && session.kind === "mobile") return true;
  return (clientHeader || "").trim().toLowerCase() === "mobile";
}

export const aiConsentRequired = () =>
  new HttpError(403, "Allow ÖRZA's AI features in the app to use this.", "ai_consent_required");

/**
 * Use instead of `requireUser()` as the first line of every route that calls the AI (R1): 401 when signed out, 403
 * `ai_consent_required` for a phone-app request from an account without consent, else the user. It applies even when
 * the AI is off, so the app's consent flow is the same either way.
 */
export async function requireAiUser(): Promise<User> {
  const current = await getCurrentSession();
  if (!current) throw unauthorized();
  const app = isAppRequest(current.via, current.session, (await headers()).get(CLIENT_HEADER));
  if (app && !hasAiConsent(current.user)) throw aiConsentRequired();
  return current.user;
}
