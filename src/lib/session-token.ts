/** Edge-safe JWT helpers (used by middleware and server code). */
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

/** Signs a session cookie for `userId`, bound to the server-side session record `sessionId`. */
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
