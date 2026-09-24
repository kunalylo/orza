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

export async function signSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
