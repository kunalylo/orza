/**
 * Server-side auth: password hashing, revocable sessions, current user, admin checks.
 *
 * Two ways to be signed in, both backed by a server-side `sessions` record:
 *   - the website: an httpOnly session cookie (`startSession`, kind "web");
 *   - the ÖRZA iOS/Android app: the same signed session token sent as `Authorization: Bearer <token>`
 *     (`startMobileSession`, kind "mobile"; no cookies are ever set for it).
 * Every check below (`getSessionUserId`, `getSessionId`, `getCurrentUser`, `requireUser`, `requireAdmin`, …)
 * takes the cookie first, else the Bearer token, and then requires the session to be live (not signed
 * out, revoked or expired). This file is the only place that decides which credential a request uses.
 */
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { col, newId } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/http";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SIGNED_IN_HINT_COOKIE,
  readSessionToken,
  sessionBearerToken,
  signSessionToken,
  type MobileClient,
  type SessionClaims,
} from "@/lib/session-token";
import type { AdminRole, AppDevice, PublicUser, Session, User } from "@/lib/types";

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

const sessions = () => col<Session>("sessions");
const devices = () => col<AppDevice>("devices");

/** How a request proved who it is: the website's session cookie or the app's Bearer session token. */
export type SessionVia = "cookie" | "bearer";
export type RequestCredential = { claims: SessionClaims; via: SessionVia };

/**
 * Picks a request's session credential: a validly signed session cookie first, else a validly signed
 * `Authorization: Bearer <session token>`. Signature and expiry only — callers then check that the
 * session is still live. Health-sync tokens (`orza_hs_…`) and other non-session Bearers are ignored.
 * Pure (no request context), so it can be unit-tested.
 */
export async function resolveCredential(
  cookieToken: string | null | undefined,
  authorization: string | null | undefined
): Promise<RequestCredential | null> {
  const fromCookie = await readSessionToken(cookieToken);
  if (fromCookie) return { claims: fromCookie, via: "cookie" };
  const fromBearer = await readSessionToken(sessionBearerToken(authorization));
  return fromBearer ? { claims: fromBearer, via: "bearer" } : null;
}

/** The current request's credential (see {@link resolveCredential}). */
async function requestCredential(): Promise<RequestCredential | null> {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value;
  const authorization = (await headers()).get("authorization");
  return resolveCredential(cookieToken, authorization);
}

/** Claims of this browser's session cookie only (a website sign-in replaces that session). */
async function cookieClaims(): Promise<SessionClaims | null> {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Records a new server-side session and returns it with its signed token. */
async function recordSession(
  userId: string,
  extra: Pick<Session, "kind" | "device_label" | "platform">
): Promise<{ session: Session; token: string }> {
  const now = Date.now();
  const session: Session = {
    id: newId(),
    user_id: userId,
    ...extra,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_MAX_AGE * 1000).toISOString(),
  };
  await sessions().insertOne(session);
  return { session, token: await signSessionToken(userId, session.id) };
}

/** Deletes the user's sessions that expired before `before` (ISO). */
async function cleanUpExpired(userId: string, before: string) {
  await sessions().deleteMany({ user_id: userId, expires_at: { $lt: before } });
}

/** Revokes one session and forgets the phone registered with it. */
async function revokeSession(userId: string, sessionId: string) {
  await sessions().deleteOne({ id: sessionId, user_id: userId });
  await devices().deleteMany({ user_id: userId, session_id: sessionId });
}

/**
 * Signs `userId` in on this browser: records a server-side session (kind "web") and sets the
 * httpOnly cookie bound to it. Any session this browser already had is replaced, and the user's
 * expired sessions are cleaned up.
 */
export async function startSession(userId: string) {
  const previous = await cookieClaims();
  const { session, token } = await recordSession(userId, { kind: "web" });
  if (previous) await sessions().deleteOne({ id: previous.sessionId, user_id: previous.userId });
  await cleanUpExpired(userId, session.created_at);

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  jar.set(SIGNED_IN_HINT_COOKIE, "1", { sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
}

/**
 * Signs `userId` in on the ÖRZA phone app: records a session of kind "mobile" (with the device name
 * and platform the app reported) and returns its token, which the app sends as
 * `Authorization: Bearer <token>`. Sets no cookies. When the request already carries an app session
 * token (signing in again on the same phone), that session is replaced. Expired sessions are cleaned up.
 */
export async function startMobileSession(userId: string, client: MobileClient = {}): Promise<{ token: string; session: Session }> {
  const previous = await readSessionToken(sessionBearerToken((await headers()).get("authorization")));
  const { session, token } = await recordSession(userId, {
    kind: "mobile",
    ...(client.device_label ? { device_label: client.device_label } : {}),
    ...(client.platform ? { platform: client.platform } : {}),
  });
  if (previous) await revokeSession(previous.userId, previous.sessionId);
  await cleanUpExpired(userId, session.created_at);
  return { token, session };
}

/**
 * Signs this request out: revokes its server-side session, so a copied cookie or token stops working
 * too. For the website the cookies are cleared as well (even when already signed out); an app request
 * (Bearer token) only revokes its session and forgets the phone registered with it. With
 * `everywhere: true`, every session of the user is revoked ("sign out of all devices", browsers and
 * apps; also use it when deleting an account).
 */
export async function endSession(opts: { everywhere?: boolean } = {}) {
  const cred = await requestCredential();
  if (cred) {
    const { userId, sessionId } = cred.claims;
    if (opts.everywhere) await revokeAllSessions(userId);
    else await revokeSession(userId, sessionId);
  }
  if (cred?.via === "bearer") return; // the app holds no cookies; nothing to clear
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 0 });
  jar.set(SIGNED_IN_HINT_COOKIE, "", { sameSite: "lax", secure, path: "/", maxAge: 0 });
}

/**
 * Revokes all of a user's sessions (browsers and phone apps), optionally keeping one (e.g. the
 * current browser or app after a password change), and forgets the phones registered with the
 * revoked app sessions. Returns how many sessions were revoked.
 */
export async function revokeAllSessions(userId: string, opts: { except?: string } = {}): Promise<number> {
  const filter: Record<string, unknown> = { user_id: userId };
  if (opts.except) filter.id = { $ne: opts.except };
  const revoked = await sessions().deleteMany(filter);
  await devices().deleteMany(opts.except ? { user_id: userId, session_id: { $ne: opts.except } } : { user_id: userId });
  return revoked;
}

async function liveSession(claims: SessionClaims): Promise<Session | null> {
  const s = await sessions().findOne({ id: claims.sessionId, user_id: claims.userId });
  if (!s || s.expires_at <= new Date().toISOString()) return null;
  return s;
}

/** Id of this request's live session, browser cookie or app Bearer token (null when signed out, expired or revoked). */
export async function getSessionId(): Promise<string | null> {
  const cred = await requestCredential();
  if (!cred) return null;
  return (await liveSession(cred.claims)) ? cred.claims.sessionId : null;
}

/** Signed-in user id for this request (cookie, else Bearer), checked against the session store (revoked sessions → null). */
export async function getSessionUserId(): Promise<string | null> {
  const cred = await requestCredential();
  if (!cred) return null;
  return (await liveSession(cred.claims)) ? cred.claims.userId : null;
}

/**
 * Admin access comes only from `is_admin: true` on the user document — granted out-of-band with
 * `node scripts/make-admin.mjs <email>`, or by a super admin creating a staff account on the Team
 * page. Never derive it from the email address: ÖRZA doesn't verify email ownership, so anyone could
 * register a listed address first. Admin accounts are staff-only (the admin console, no member app).
 */
export const isAdmin = (u: Pick<User, "is_admin">) => u.is_admin === true;

/** The admin's role ("super" | "sub"), or null for members. An admin without a stored role is a sub-admin. */
export function adminRoleOf(u: Pick<User, "is_admin" | "admin_role">): AdminRole | null {
  if (!isAdmin(u)) return null;
  return u.admin_role === "super" ? "super" : "sub";
}

/** Super admins manage the team (create, reset and remove sub-admins). */
export const isSuperAdmin = (u: Pick<User, "is_admin" | "admin_role">) => adminRoleOf(u) === "super";

export function toPublicUser(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = u;
  // Credentials never needed in the browser: the hashed health-sync token, the calendar feed token
  // (the page gets the feed link from /api/calendar or /api/integrations) and the user's secret iCal
  // address for their own calendar (only its connection state is shown, via /api/calendar).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { health_token_hash, calendar_token, external_ical_url, ...integrations } = u.integrations || {};
  // `admin_role` is only sent for admins (a stray role on a member record means nothing).
  return { ...rest, ...(u.integrations ? { integrations } : {}), is_admin: isAdmin(u), admin_role: adminRoleOf(u) ?? undefined };
}

/**
 * The signed-in user with their live session and how the request authenticated (cookie or Bearer),
 * or null. The user document includes password_hash — never return it to clients.
 */
export async function getCurrentSession(): Promise<{ user: User; session: Session; via: SessionVia } | null> {
  const cred = await requestCredential();
  if (!cred) return null;
  const [session, user] = await Promise.all([liveSession(cred.claims), col<User>("users").findOne({ id: cred.claims.userId })]);
  return session && user ? { user, session, via: cred.via } : null;
}

/** Full user document for this request, cookie or app Bearer token (includes password_hash — never return it to clients). */
export async function getCurrentUser(): Promise<User | null> {
  return (await getCurrentSession())?.user ?? null;
}

/** Use in route handlers: throws 401 when signed out (accepts the website's cookie and the app's Bearer token). */
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}

/** Use in admin route handlers: 401 when signed out, 403 for members (cookie or Bearer, like requireUser). */
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!isAdmin(u)) throw forbidden();
  return u;
}

/** Use in team-management route handlers: 401 when signed out, 403 for members and sub-admins. */
export async function requireSuperAdmin(): Promise<User> {
  const u = await requireAdmin();
  if (!isSuperAdmin(u)) throw forbidden("Only the super admin can manage the admin team");
  return u;
}

/**
 * Use in routes only the phone app calls (device registration): the signed-in user and their live
 * app session. 401 when signed out; 403 unless the request is signed in with an app session's Bearer
 * token (a browser cookie can't register a phone).
 */
export async function requireMobileSession(): Promise<{ user: User; session: Session }> {
  const current = await getCurrentSession();
  if (!current) throw unauthorized();
  if (current.via !== "bearer" || current.session.kind !== "mobile") {
    throw forbidden("Only the ÖRZA app can register a phone. Sign in to the app to continue.");
  }
  return { user: current.user, session: current.session };
}
