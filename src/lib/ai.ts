/**
 * OpenAI client (plain fetch, no SDK).
 * Everything AI-powered must check `aiEnabled()` and fall back to a
 * deterministic path when it is false (except photo scanning, which returns 503).
 */
import { HttpError } from "@/lib/http";

export const aiEnabled = () => !!process.env.OPENAI_API_KEY;
const TEXT_MODEL = () => process.env.OPENAI_MODEL || "gpt-4o-mini";
const VISION_MODEL = () => process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

/** Shared guardrail appended to every system prompt. */
export const WELLNESS_GUARDRAIL =
  "You are ÖRZA, a warm, judgment-free AI wellness companion with deep knowledge of Indian and global cuisines. " +
  "You give general wellness and nutrition guidance only — never diagnose diseases, prescribe or change medication, or handle emergencies. " +
  "If the user describes a medical emergency or symptoms that need a professional, gently tell them to contact a doctor or local emergency services. " +
  "Never shame the user about food. Keep answers concise and practical. Reply in the user's language (English, Hindi, or Hinglish).";

async function callOpenAI(body: Record<string, unknown>, timeoutMs = 45000): Promise<string> {
  if (!aiEnabled()) throw new HttpError(503, "AI is not configured on this server yet.", "ai_disabled");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[orza] OpenAI error", res.status, text.slice(0, 500));
      if (res.status === 429) throw new HttpError(503, "ÖRZA's AI is busy right now. Please try again in a moment.", "ai_busy");
      throw new HttpError(502, "ÖRZA's AI couldn't process that. Please try again.", "ai_error");
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new HttpError(502, "ÖRZA's AI returned an empty answer.", "ai_empty");
    return content;
  } catch (e: any) {
    if (e instanceof HttpError) throw e;
    if (e?.name === "AbortError") throw new HttpError(504, "ÖRZA's AI took too long. Please try again.", "ai_timeout");
    console.error("[orza] OpenAI request failed", e);
    throw new HttpError(502, "Couldn't reach ÖRZA's AI. Please try again.", "ai_error");
  } finally {
    clearTimeout(timer);
  }
}

/** Free-text completion. */
export async function aiText(opts: { system: string; messages: ChatTurn[]; temperature?: number; maxTokens?: number }): Promise<string> {
  return callOpenAI({
    model: TEXT_MODEL(),
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 700,
    messages: [{ role: "system", content: `${opts.system}\n\n${WELLNESS_GUARDRAIL}` }, ...opts.messages],
  });
}

/**
 * JSON completion. `shape` is a plain-English/JSON description of the expected object
 * that is appended to the system prompt. Optionally include an image (data URL or https URL).
 */
export async function aiJSON<T = any>(opts: {
  system: string;
  prompt: string;
  shape: string;
  imageUrl?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const userContent: any = opts.imageUrl
    ? [
        { type: "text", text: opts.prompt },
        { type: "image_url", image_url: { url: opts.imageUrl, detail: "high" } },
      ]
    : opts.prompt;
  const raw = await callOpenAI(
    {
      model: opts.imageUrl ? VISION_MODEL() : TEXT_MODEL(),
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${opts.system}\n\n${WELLNESS_GUARDRAIL}\n\nRespond ONLY with a JSON object of this shape:\n${opts.shape}` },
        { role: "user", content: userContent },
      ],
    },
    opts.imageUrl ? 60000 : 45000
  );
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as T;
      } catch {
        /* fallthrough */
      }
    }
    throw new HttpError(502, "ÖRZA's AI returned an unexpected answer. Please try again.", "ai_parse");
  }
}
