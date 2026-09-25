/** Server-side auth: password hashing, revocable sessions, current user, admin checks. */
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { col, newId } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/http";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SIGNED_IN_HINT_COOKIE,
  readSessionToken,
  signSessionToken,
  type SessionClaims,
} from "@/lib/session-token";
import type { PublicUser, Session, User } from "@/lib/types";

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

const sessions = () => col<Session>("sessions");

async function cookieClaims(): Promise<SessionClaims | null> {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/**
 * Signs `userId` in on this browser: records a server-side session and sets the httpOnly cookie
 * bound to it. Any session this browser already had is replaced, and the user's expired sessions
 * are cleaned up.
 */
export async function startSession(userId: string) {
  const previous = await cookieClaims();
  const now = Date.now();
  const session: Session = {
    id: newId(),
    user_id: userId,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_MAX_AGE * 1000).toISOString(),
  };
  await sessions().insertOne(session);
  if (previous) await sessions().deleteOne({ id: previous.sessionId, user_id: previous.userId });
  await sessions().deleteMany({ user_id: userId, expires_at: { $lt: session.created_at } });

  const token = await signSessionToken(userId, session.id);
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  jar.set(SIGNED_IN_HINT_COOKIE, "1", { sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
}

/**
 * Signs this browser out: revokes its server-side session (so a copied cookie stops working too)
 * and clears the cookies. With `everywhere: true`, every session of the user is revoked
 * ("sign out of all devices"; also use it when deleting an account).
 */
export async function endSession(opts: { everywhere?: boolean } = {}) {
  const claims = await cookieClaims();
  if (claims) {
    if (opts.everywhere) await revokeAllSessions(claims.userId);
    else await sessions().deleteOne({ id: claims.sessionId, user_id: claims.userId });
  }
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
  jar.set(SIGNED_IN_HINT_COOKIE, "", { sameSite: "lax", secure, path: "/", maxAge: 0 });
}

/**
 * Revokes all of a user's sessions, optionally keeping one (e.g. the current browser after a
 * password change). Returns how many were revoked.
 */
export async function revokeAllSessions(userId: string, opts: { except?: string } = {}): Promise<number> {
  const filter: Record<string, unknown> = { user_id: userId };
  if (opts.except) filter.id = { $ne: opts.except };
  return sessions().deleteMany(filter);
}

/** Id of the current browser's live session (null when signed out, expired or revoked). */
export async function getSessionId(): Promise<string | null> {
  const claims = await cookieClaims();
  if (!claims) return null;
  return (await liveSession(claims)) ? claims.sessionId : null;
}

async function liveSession(claims: SessionClaims): Promise<Session | null> {
  const s = await sessions().findOne({ id: claims.sessionId, user_id: claims.userId });
  if (!s || s.expires_at <= new Date().toISOString()) return null;
  return s;
}

/** Signed-in user id for this request, checked against the session store (revoked sessions → null). */
export async function getSessionUserId(): Promise<string | null> {
  const claims = await cookieClaims();
  if (!claims) return null;
  return (await liveSession(claims)) ? claims.userId : null;
}

/**
 * Admin access comes only from `is_admin: true` on the user document, granted out-of-band with
 * `node scripts/make-admin.mjs <email>`. Never derive it from the email address: ÖRZA doesn't verify
 * email ownership, so anyone could register a listed address first.
 */
export const isAdmin = (u: Pick<User, "is_admin">) => u.is_admin === true;

export function toPublicUser(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = u;
  // The hashed health-sync token is a credential derivative: never needed in the browser.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { health_token_hash, ...integrations } = u.integrations || {};
  return { ...rest, ...(u.integrations ? { integrations } : {}), is_admin: isAdmin(u) };
}

/** Full user document (includes password_hash — never return it to clients). */
export async function getCurrentUser(): Promise<User | null> {
  const claims = await cookieClaims();
  if (!claims) return null;
  const [session, user] = await Promise.all([liveSession(claims), col<User>("users").findOne({ id: claims.userId })]);
  return session && user ? user : null;
}

/** Use in route handlers: throws 401 when signed out. */
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!isAdmin(u)) throw forbidden();
  return u;
}
