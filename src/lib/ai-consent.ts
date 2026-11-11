/**
 * AI consent: the member's permission for ÖRZA's AI features, which OpenAI runs (App Store 5.1.2(i), Google Play
 * User Data policy). One record per account, `users.ai_consent = {version, at}` (absent or null = none), set and
 * withdrawn with PUT / DELETE /api/settings/ai-consent and sent in every `{user}` answer (`toPublicUser`, null when none).
 * The website and the phone app both ask before the first AI request (src/components/ai on the website), so one Allow
 * or Turn off works everywhere.
 *
 * - R1, every client: the six routes that call the AI (chat/send, meals/text, meals/scan, recipes/generate,
 *   compensation/plan, prescriptions/scan) start with `requireAiUser()`. It refuses a request from an account without
 *   consent with 403 `ai_consent_required` before the body is read, credits move, a photo is stored or `aiEnabled()` is
 *   asked — from the phone app and the website alike.
 * - R2, a second line: for an account without consent, Ask ÖRZA's AI prompt leaves out today's tracked steps and the
 *   replies that can quote tracked steps or weight (`contextForPrompt` and `aiHistory` in src/lib/coach.ts). R1 now
 *   refuses those requests first.
 */
import { headers } from "next/headers";
import { getCurrentSession, type SessionVia } from "@/lib/auth";
import { hasAiConsent } from "@/lib/ai-consent-shared";
import { HttpError, unauthorized } from "@/lib/http";
import { CLIENT_HEADER } from "@/lib/session-token";
import type { Session, User } from "@/lib/types";

export { AI_CONSENT_VERSION, hasAiConsent } from "@/lib/ai-consent-shared";

/**
 * Whether a request comes from the ÖRZA phone app: signed in with an app session's Bearer token (kind "mobile"), or
 * sending `X-ORZA-Client: mobile`. Pure.
 */
export function isAppRequest(via: SessionVia, session: Pick<Session, "kind">, clientHeader: string | null | undefined): boolean {
  if (via === "bearer" && session.kind === "mobile") return true;
  return (clientHeader || "").trim().toLowerCase() === "mobile";
}

/**
 * The 403 for a request without consent. Both clients act on the code and show their own consent sheet or dialog; the
 * website's text is for a tab still running a page from before the website asked (it has no dialog yet).
 */
export const aiConsentRequired = (app = true) =>
  new HttpError(
    403,
    app ? "Allow ÖRZA's AI features in the app to use this." : "Please reload the page to allow ÖRZA's AI features.",
    "ai_consent_required"
  );

/**
 * Use instead of `requireUser()` as the first line of every route that calls the AI (R1): 401 when signed out, 403
 * `ai_consent_required` for an account without consent (any client), else the user. It applies even when the AI is
 * off, so the consent flow is the same either way.
 */
export async function requireAiUser(): Promise<User> {
  const current = await getCurrentSession();
  if (!current) throw unauthorized();
  if (!hasAiConsent(current.user)) {
    throw aiConsentRequired(isAppRequest(current.via, current.session, (await headers()).get(CLIENT_HEADER)));
  }
  return current.user;
}
