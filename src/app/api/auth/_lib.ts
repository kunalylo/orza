/**
 * Shared helpers for the auth routes: input schemas, request-origin guard, a small in-memory
 * rate limiter, and friendly validation responses. (Not a route — Next only routes `route.ts`.)
 */
import { z, type ZodTypeAny } from "zod";
import { BODY_LIMIT_SMALL, assertSameOriginJson, json, readJsonBody } from "@/lib/http";

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

/**
 * Blocks cross-site form posts (login CSRF): the routes that set or clear the session cookie must be
 * called by ÖRZA's own pages with a JSON body. route() in @/lib/http applies the same check to every
 * state-changing route; the auth routes also call it first thing, before any rate-limit bookkeeping.
 */
export { assertSameOriginJson };

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
