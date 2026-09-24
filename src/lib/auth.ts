/** Server-side auth: password hashing, session cookie, current user. */
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { col } from "@/lib/db";
import { forbidden, unauthorized } from "@/lib/http";
import { SESSION_COOKIE, SESSION_MAX_AGE, SIGNED_IN_HINT_COOKIE, signSessionToken, verifySessionToken } from "@/lib/session-token";
import type { PublicUser, User } from "@/lib/types";

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function startSession(userId: string) {
  const token = await signSessionToken(userId);
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
  jar.set(SIGNED_IN_HINT_COOKIE, "1", { sameSite: "lax", secure, path: "/", maxAge: SESSION_MAX_AGE });
}

export async function endSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  jar.set(SIGNED_IN_HINT_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getSessionUserId(): Promise<string | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export function isAdminEmail(email: string) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function toPublicUser(u: User): PublicUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...rest } = u;
  return { ...rest, is_admin: !!u.is_admin || isAdminEmail(u.email) };
}

/** Full user document (includes password_hash — never return it to clients). */
export async function getCurrentUser(): Promise<User | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  return col<User>("users").findOne({ id });
}

/** Use in route handlers: throws 401 when signed out. */
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw unauthorized();
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!(u.is_admin || isAdminEmail(u.email))) throw forbidden();
  return u;
}
