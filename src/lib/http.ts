import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { SITE } from "@/lib/site";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, "bad_request");
export const unauthorized = (msg = "Please sign in to continue") => new HttpError(401, msg, "unauthorized");
export const forbidden = (msg = "You don't have access to this") => new HttpError(403, msg, "forbidden");
export const notFound = (msg = "Not found") => new HttpError(404, msg, "not_found");

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export type RouteOptions = {
  /**
   * The route authenticates with a token or secret it checks itself (health sync Bearer token, cron
   * secret) rather than the session cookie, so the cross-site guard below doesn't apply: its callers
   * are automation apps and schedulers that send no Origin and may not send a JSON Content-Type.
   */
  tokenAuth?: boolean;
};

/**
 * Wrap a route handler: converts HttpError / ZodError / unknown errors into
 * `{ error: string, code?: string }` JSON responses with the right status.
 *
 * Every state-changing request (anything but GET/HEAD/OPTIONS) must also pass
 * {@link assertSameOriginRequest} (CSRF hardening on top of the SameSite=Lax session cookie), unless the
 * route opts out with `{ tokenAuth: true }`.
 */
export function route<A extends any[]>(fn: (...args: A) => Promise<Response>, opts: RouteOptions = {}) {
  return async (...args: A): Promise<Response> => {
    try {
      const req: unknown = args[0];
      if (!opts.tokenAuth && isRequest(req)) assertSameOriginRequest(req);
      return await fn(...args);
    } catch (e: any) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const where = first?.path?.length ? `${first.path.join(".")}: ` : "";
        return json({ error: `${where}${first?.message || "Invalid input"}`, code: "validation" }, 400);
      }
      console.error("[orza] unhandled route error", e);
      return json({ error: "Something went wrong. Please try again.", code: "server_error" }, 500);
    }
  };
}

/* ───────────────────────── Cross-site request guard ───────────────────────── */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Duck-typed so a Request from another realm (NextRequest, test runners) is still guarded. */
const isRequest = (v: unknown): v is Request =>
  !!v && typeof v === "object" && typeof (v as Request).method === "string" && typeof (v as Request).headers?.get === "function";

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

const notJson = () => new HttpError(415, "Please send the request as JSON.", "unsupported_media_type");

const mediaType = (req: Request) => (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

/**
 * Refuses requests a browser sent from another site. Browsers send `Sec-Fetch-Site` and `Origin` on
 * POST/PUT/PATCH/DELETE and a page can't forge them; non-browser clients (no such headers) can't ride
 * a victim's cookies, so they pass.
 */
export function assertSameOrigin(req: Request) {
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
}

/**
 * {@link assertSameOrigin} plus a JSON `Content-Type`: HTML forms can't send one, and a cross-origin
 * `fetch` with it needs a CORS preflight that ÖRZA never grants.
 */
export function assertSameOriginJson(req: Request) {
  assertSameOrigin(req);
  if (mediaType(req) !== "application/json") throw notJson();
}

/**
 * The guard {@link route} applies to cookie-authenticated routes: safe methods pass; everything else
 * must be same-origin and JSON. A DELETE without a body (the api client's `del`) may omit the
 * Content-Type — browsers can't send a cross-site DELETE at all without a preflight.
 * Uploads are JSON too (photos travel as data URLs), so they pass unchanged.
 */
export function assertSameOriginRequest(req: Request) {
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return;
  assertSameOrigin(req);
  const type = mediaType(req);
  if (type === "application/json" || (method === "DELETE" && !type)) return;
  throw notJson();
}

/* ───────────────────────── Request bodies ───────────────────────── */

/**
 * Route handlers have no built-in body limit (Next's `serverActions.bodySizeLimit` only covers
 * Server Actions), so every body is read through a byte cap before it is parsed.
 *
 * - `BODY_LIMIT_DEFAULT` (1 MB) — ordinary JSON: forms, settings, chat, meal text.
 * - `BODY_LIMIT_SMALL` (16 KB) — public / unauthenticated forms (auth, leads).
 * - `BODY_LIMIT_UPLOAD` (12 MB) — routes that accept base64 photos or bulk imports
 *   (meal & prescription scans, medicine photos, health imports). Pass it explicitly.
 */
export const BODY_LIMIT_SMALL = 16 * 1024;
export const BODY_LIMIT_DEFAULT = 1024 * 1024;
export const BODY_LIMIT_UPLOAD = 12 * 1024 * 1024;

export type BodyOptions = { maxBytes?: number };

const formatBytes = (n: number) => (n >= 1024 * 1024 ? `${Math.round(n / (1024 * 1024))} MB` : `${Math.round(n / 1024)} KB`);

export const payloadTooLarge = (maxBytes: number) =>
  new HttpError(413, `That's more data than ÖRZA accepts in one request (limit ${formatBytes(maxBytes)}).`, "payload_too_large");

/**
 * Read the raw body as UTF-8 text, refusing it with 413 once it exceeds `maxBytes`.
 * Checks Content-Length up front and counts streamed bytes too (chunked uploads have no length).
 */
export async function readBodyText(req: Request, { maxBytes = BODY_LIMIT_DEFAULT }: BodyOptions = {}): Promise<string> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw payloadTooLarge(maxBytes);
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw payloadTooLarge(maxBytes);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Read and JSON-parse a body under a byte cap (400 on invalid JSON, 413 when too large). */
export async function readJsonBody(req: Request, opts?: BodyOptions): Promise<unknown> {
  const text = await readBodyText(req, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
}

/**
 * Parse and validate a JSON body with a zod schema. Bodies over 1 MB are refused with 413;
 * routes that accept photos or bulk imports pass `{ maxBytes: BODY_LIMIT_UPLOAD }`.
 */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S, opts?: BodyOptions): Promise<z.infer<S>> {
  return schema.parse(await readJsonBody(req, opts));
}
