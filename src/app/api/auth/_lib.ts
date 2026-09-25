/**
 * Shared helpers for the auth routes: input schemas, request-origin guard, a small in-memory
 * rate limiter, and friendly validation responses. (Not a route — Next only routes `route.ts`.)
 */
import { z, type ZodTypeAny } from "zod";
import { BODY_LIMIT_SMALL, HttpError, json, readJsonBody } from "@/lib/http";
import { SITE } from "@/lib/site";

export const emailSchema = z
  .string({ required_error: "Please enter your email" })
  .trim()
  .toLowerCase()
  .min(1, "Please enter your email")
  .max(254, "That email is too long")
  .email("Please enter a valid email address");

export const registerSchema = z.object({
  name: z
    .string({ required_error: "Please enter your name" })
    .trim()
    .min(1, "Please enter your name")
    .max(60, "Please keep your name under 60 characters"),
  email: emailSchema,
  password: z
    .string({ required_error: "Please choose a password" })
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Please enter your password" })
    .min(1, "Please enter your password")
    .max(128, "Incorrect email or password"),
});

/* ───────────────────────── Request origin guard ───────────────────────── */

const hostOf = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
};

const crossSite = () =>
  new HttpError(403, "This request didn't come from ÖRZA. Please refresh the page and try again.", "cross_site");

/**
 * Blocks cross-site form posts (login CSRF): the routes that set or clear the session cookie must be
 * called by ÖRZA's own pages. Browsers send `Sec-Fetch-Site` and `Origin` on POSTs and a page can't
 * forge them; non-browser clients (no such headers) can't ride a victim's cookies, so they pass.
 * A JSON `Content-Type` is also required — HTML forms can't send it, and a cross-origin `fetch`
 * with it needs a CORS preflight that ÖRZA never grants.
 */
export function assertSameOriginJson(req: Request) {
  const site = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (site && site !== "same-origin" && site !== "none") throw crossSite();

  const origin = req.headers.get("origin");
  if (origin) {
    const originHost = origin === "null" ? null : hostOf(origin);
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
    const allowed = new Set(
      [req.headers.get("host")?.toLowerCase(), forwardedHost, hostOf(req.url), hostOf(SITE.url)].filter(Boolean) as string[]
    );
    if (!originHost || !allowed.has(originHost)) throw crossSite();
  }

  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "Please send the request as JSON.", "unsupported_media_type");
}

/**
 * Parse a JSON body; on failure respond 400 `{ error, code: "validation", field }` with the
 * schema's own friendly message (no "path:" prefix) so the form can show it inline.
 * Also enforces {@link assertSameOriginJson}.
 */
export async function parseAuthBody<S extends ZodTypeAny>(
  req: Request,
  schema: S
): Promise<{ data: z.infer<S>; error?: undefined } | { data?: undefined; error: Response }> {
  assertSameOriginJson(req);
  // Unauthenticated: read at most 16 KB, so an oversized body is refused (413) before it is buffered.
  const raw = await readJsonBody(req, { maxBytes: BODY_LIMIT_SMALL });
  const r = schema.safeParse(raw);
  if (r.success) return { data: r.data };
  const issue = r.error.issues[0];
  return {
    error: json({ error: issue?.message || "Invalid input", code: "validation", field: issue?.path?.[0] ?? null }, 400),
  };
}

/* ───────────────────────── Client IP + rate limiting ───────────────────────── */

// Shared with the public leads form; see src/lib/rate-limit.ts.
export { ONE_HOUR, TEN_MINUTES, clearLimit, clientIp, peek, release, reserve, tooManyRequests, type Limit } from "@/lib/rate-limit";
