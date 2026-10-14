/** Edge-safe session-token helpers (used by middleware and server code): JWT signing/verification and Bearer/cookie header parsing. */
import { SignJWT, jwtVerify } from "jose";
export { SESSION_COOKIE, SIGNED_IN_HINT_COOKIE } from "@/lib/cookie-names";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const DEV_SECRET = "orza-dev-only-secret-change-me-in-production-please";

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set (32+ random characters) in production");
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(s);
}

export type SessionClaims = { userId: string; sessionId: string };

/** Signs a session token for `userId` (the website's cookie, or the phone app's Bearer token), bound to the server-side session record `sessionId`. */
export async function signSessionToken(userId: string, sessionId: string) {
  return new SignJWT({ sub: userId, sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

/**
 * Verifies the signature and expiry only. Whether the session is still live (not signed out or
 * revoked) is checked against the database by `getSessionUserId()` in src/lib/auth.ts — middleware
 * uses this as a fast pre-check, never as the final word.
 */
export async function readSessionToken(token: string | undefined | null): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

/** User id from a validly signed session token (signature + expiry only; see `readSessionToken`). */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  return (await readSessionToken(token))?.userId ?? null;
}

/* ───────────────────────── ÖRZA phone app (Bearer sessions) ───────────────────────── */
// Pure, dependency-free helpers shared by auth.ts (which accepts the token) and http.ts (the
// cross-site guard). They only look at header shapes; whether a token is valid and its session
// still live is decided in src/lib/auth.ts.

/** Sign-in/sign-up header the phone app sends ("mobile") to get `{user, token}` instead of cookies. */
export const CLIENT_HEADER = "x-orza-client";
/** Optional device name for the app session (URL-encode non-ASCII names). */
export const DEVICE_HEADER = "x-orza-device";
/** Optional app platform for the app session: "ios" | "android". */
export const PLATFORM_HEADER = "x-orza-platform";

/** Health-sync tokens (src/lib/care/health.ts `HEALTH_TOKEN_PREFIX`) are a different credential. */
const HEALTH_SYNC_TOKEN_PREFIX = "orza_hs_";
/** A compact JWS: three base64url segments. */
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
/** Session tokens are ~200 characters; anything far longer is not one of ours. */
const MAX_BEARER_LENGTH = 2048;
const DEVICE_LABEL_MAX = 80;

/**
 * The session token from an `Authorization: Bearer <token>` header, or null when the header is
 * missing, isn't a Bearer, or carries something that can't be a session token — notably health-sync
 * tokens (`orza_hs_…`, which only /api/health/sync accepts) and the cron secret.
 */
export function sessionBearerToken(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const token = /^\s*Bearer\s+(\S+)\s*$/i.exec(authorization)?.[1];
  if (!token || token.length > MAX_BEARER_LENGTH) return null;
  if (token.startsWith(HEALTH_SYNC_TOKEN_PREFIX)) return null;
  return JWT_SHAPE.test(token) ? token : null;
}

/** Value of cookie `name` in a raw `Cookie` header ("" counts as absent). */
export function cookieFromHeader(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    return value || null;
  }
  return null;
}

export type MobileClient = { device_label?: string; platform?: "ios" | "android" };

/** A device name made safe to store and show: no control characters, single spaces, ≤ 80 characters. */
export function cleanDeviceLabel(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return Array.from(s).slice(0, DEVICE_LABEL_MAX).join("").trim();
}

/**
 * Whether a sign-in/sign-up request comes from the ÖRZA phone app (`X-ORZA-Client: mobile`), with the
 * optional device name (`X-ORZA-Device`) and platform (`X-ORZA-Platform`). Null for the website.
 */
export function mobileClientFrom(headers: Pick<Headers, "get">): MobileClient | null {
  if ((headers.get(CLIENT_HEADER) || "").trim().toLowerCase() !== "mobile") return null;
  // Header values are Latin-1 only, so the app URL-encodes names like "Asha’s iPhone".
  let label = headers.get(DEVICE_HEADER) || "";
  if (/%[0-9A-Fa-f]{2}/.test(label)) {
    try {
      label = decodeURIComponent(label);
    } catch {
      /* keep it as sent */
    }
  }
  const device_label = cleanDeviceLabel(label);
  const platform = (headers.get(PLATFORM_HEADER) || "").trim().toLowerCase();
  return {
    ...(device_label ? { device_label } : {}),
    ...(platform === "ios" || platform === "android" ? { platform } : {}),
  };
}
