import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

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

/**
 * Wrap a route handler: converts HttpError / ZodError / unknown errors into
 * `{ error: string, code?: string }` JSON responses with the right status.
 */
export function route<A extends any[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
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
