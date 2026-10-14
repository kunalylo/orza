/**
 * WhatsApp delivery through Meta's WhatsApp Cloud API.
 *
 * Env: WHATSAPP_TOKEN (permanent system-user token), WHATSAPP_PHONE_NUMBER_ID (the sender number's id),
 * optional WHATSAPP_TEMPLATE_NAME + WHATSAPP_TEMPLATE_LANG.
 *
 * - With a template configured, reminders go out as that approved template with two body variables:
 *   {{1}} = title, {{2}} = details. Templates reach people any time.
 * - Without one, a plain text message is sent. WhatsApp only delivers free-form messages inside the
 *   24-hour customer-service window (i.e. the person messaged the ÖRZA number in the last 24 h).
 * - The medicine photo follows as an image message. WhatsApp's servers must download it, so it is only
 *   sent when the site has a public URL (never for localhost / private hosts).
 */
import { SITE } from "@/lib/site";
import { E164_RE } from "@/components/care/reminders/shared";

const GRAPH_URL = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 10_000;

export class WhatsAppError extends Error {
  constructor(message: string, public code?: number, public status?: number) {
    super(message);
    this.name = "WhatsAppError";
  }
}

export interface WhatsAppMessage {
  title: string;
  body: string;
  /** Absolute https URL of an image WhatsApp can download (e.g. a signed medicine photo). */
  imageUrl?: string;
  imageCaption?: string;
  /** Absolute link appended to text messages ("Open in ÖRZA"). */
  link?: string;
}

export interface WhatsAppResult {
  mode: "template" | "text";
  message_id?: string;
  /** "sent", "skipped" (no image / no public URL) or the error text. */
  image: string;
}

const env = () => ({
  token: (process.env.WHATSAPP_TOKEN || "").trim(),
  phoneId: (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim(),
  template: (process.env.WHATSAPP_TEMPLATE_NAME || "").trim(),
  lang: (process.env.WHATSAPP_TEMPLATE_LANG || "en").trim() || "en",
});

/** True when the admin has connected a WhatsApp Business sender. */
export function whatsappConfigured(): boolean {
  const e = env();
  return !!(e.token && e.phoneId);
}

/** "template" when an approved template is configured (works any time), else "session" (24-hour window only). */
export function whatsappMode(): "template" | "session" {
  return env().template ? "template" : "session";
}

/** The site origin when it's reachable from the internet, else null (localhost, LAN, .local). */
export function publicBaseUrl(): string | null {
  try {
    const u = new URL(SITE.url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const privateHost =
      h === "localhost" ||
      h.endsWith(".localhost") ||
      h.endsWith(".local") ||
      h.endsWith(".internal") ||
      h === "0.0.0.0" ||
      h === "::1" ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^169\.254\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      /^f[cd][0-9a-f]{2}:/.test(h) ||
      /^fe80:/.test(h);
    return privateHost ? null : u.origin;
  } catch {
    return null;
  }
}

/** Absolute URL for an app path, only when the site is publicly reachable. */
export function publicUrl(path: string): string | null {
  const base = publicBaseUrl();
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : null;
}

/** Template variables may not contain newlines, tabs or 4+ consecutive spaces, and can't be empty. */
function templateParam(s: string, max = 900) {
  const clean = (s || "").replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim();
  const cut = clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
  return cut || "—";
}

/**
 * A setup problem only the operator can fix: log the technical hint for them and give people a plain
 * message (member-facing copy never mentions env vars or admins).
 */
function operatorIssue(hint: string): string {
  console.error(`[orza] WhatsApp setup problem: ${hint}`);
  return "WhatsApp messages aren't available right now. Please try again later.";
}

function explain(err: any, status: number): string {
  const code = Number(err?.code);
  const e = env();
  const detail = String(err?.error_data?.details || err?.message || "").trim();
  switch (code) {
    case 190:
      return operatorIssue("the access token is invalid or has expired — renew WHATSAPP_TOKEN");
    case 10:
    case 200:
    case 294:
      return "The WhatsApp token doesn't have permission to send messages from this number.";
    case 131030:
      return "This number isn't on the allowed recipient list of ÖRZA's WhatsApp test account yet.";
    case 131047:
      return "WhatsApp only delivers free-form messages within 24 hours of your last message to ÖRZA. Send any message to ÖRZA's WhatsApp number and try again.";
    case 131026:
      return "WhatsApp couldn't deliver to this number. Check that it's registered on WhatsApp.";
    case 131051:
      return "WhatsApp doesn't support this message type for this number.";
    case 132000:
      return `The WhatsApp template "${e.template}" must have exactly two body variables: {{1}} for the title and {{2}} for the details.`;
    case 132001:
      return `The WhatsApp template "${e.template}" wasn't found in language "${e.lang}", or isn't approved yet.`;
    case 132005:
    case 132007:
      return `WhatsApp rejected the text for template "${e.template}" (too long or not allowed by its policy).`;
    case 132015:
    case 132016:
      return `The WhatsApp template "${e.template}" is paused or disabled by Meta.`;
    case 133010:
      return "ÖRZA's WhatsApp sender number isn't registered with the Cloud API yet.";
    case 4:
    case 80007:
    case 130429:
    case 131048:
    case 131056:
      return "WhatsApp's sending limit was reached. Please try again in a minute.";
    case 131000:
      return "WhatsApp had a temporary problem. Please try again shortly.";
    case 100:
      return `WhatsApp rejected the request: ${detail || "invalid parameter"}.`;
    default:
      if (status === 401) return operatorIssue("credentials rejected (HTTP 401) — check WHATSAPP_TOKEN");
      if (status === 404) return operatorIssue("sender number not found (HTTP 404) — check WHATSAPP_PHONE_NUMBER_ID");
      if (status >= 500) return "WhatsApp is having trouble right now. Please try again shortly.";
      return detail ? `WhatsApp error: ${detail.slice(0, 200)}` : `WhatsApp request failed (HTTP ${status}).`;
  }
}

async function graphSend(message: Record<string, unknown>): Promise<string | undefined> {
  const e = env();
  if (!e.token || !e.phoneId) throw new WhatsAppError("WhatsApp messages aren't available right now.", undefined, 503);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GRAPH_URL}/${encodeURIComponent(e.phoneId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${e.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...message }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok || data?.error) {
      const err = data?.error;
      throw new WhatsAppError(explain(err, res.status), Number(err?.code) || undefined, res.status);
    }
    return data?.messages?.[0]?.id;
  } catch (err: any) {
    if (err instanceof WhatsAppError) throw err;
    if (err?.name === "AbortError") throw new WhatsAppError("WhatsApp didn't respond in time. Please try again.");
    throw new WhatsAppError("Couldn't reach WhatsApp's servers. Please try again.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a reminder to `toE164` (e.g. "+919876543210"). Throws WhatsAppError with a human-readable
 * message when the main message fails; an image failure is reported in `result.image` instead.
 */
export async function sendWhatsApp(toE164: string, msg: WhatsAppMessage): Promise<WhatsAppResult> {
  if (!E164_RE.test(toE164 || "")) throw new WhatsAppError("That WhatsApp number isn't a valid international number.");
  const to = toE164.slice(1);
  const e = env();
  let mode: WhatsAppResult["mode"];
  let message_id: string | undefined;

  if (e.template) {
    mode = "template";
    message_id = await graphSend({
      to,
      type: "template",
      template: {
        name: e.template,
        language: { code: e.lang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: templateParam(msg.title, 200) },
              { type: "text", text: templateParam([msg.body, msg.link].filter(Boolean).join(" · ")) },
            ],
          },
        ],
      },
    });
  } else {
    mode = "text";
    const text = [`*${msg.title.trim()}*`, msg.body.trim(), msg.link ? `Open in ÖRZA: ${msg.link}` : ""].filter(Boolean).join("\n");
    message_id = await graphSend({ to, type: "text", text: { preview_url: false, body: text.slice(0, 4000) } });
  }

  let image = "skipped";
  if (msg.imageUrl && /^https:\/\//i.test(msg.imageUrl)) {
    try {
      await graphSend({
        to,
        type: "image",
        image: { link: msg.imageUrl, ...(msg.imageCaption ? { caption: msg.imageCaption.slice(0, 1000) } : {}) },
      });
      image = "sent";
    } catch (err) {
      image = err instanceof Error ? err.message : "Image failed";
    }
  }
  return { mode, message_id, image };
}
