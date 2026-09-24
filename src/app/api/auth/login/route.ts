import { hashPassword, startSession, toPublicUser, verifyPassword } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, route, unauthorized } from "@/lib/http";
import type { User } from "@/lib/types";
import { TEN_MINUTES, clearLimit, clientIp, hit, limited, loginSchema, parseAuthBody, tooManyRequests } from "../_lib";

export const dynamic = "force-dynamic";

const BAD_CREDENTIALS = "Incorrect email or password";

// Compared against when the email is unknown so both paths take the same time (no account enumeration by timing).
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ||= hashPassword("orza-timing-equaliser-not-a-password"));

/** POST /api/auth/login {email, password} → {user} + session cookie; generic 401 on bad credentials. */
export const POST = route(async (req: Request) => {
  const parsed = await parseAuthBody(req, loginSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  const ip = clientIp(req);
  const pairKey = `login:${ip}|${email}`; // 10 failed attempts / 10 min per IP + email
  const ipKey = `login-ip:${ip}`; // 50 failed attempts / 10 min per IP (credential stuffing)
  const wait = Math.max(limited(pairKey, 10, TEN_MINUTES), limited(ipKey, 50, TEN_MINUTES));
  if (wait) return tooManyRequests(wait, "Too many sign-in attempts.");

  const user = await col<User>("users").findOne({ email });
  let ok = false;
  if (user?.password_hash) ok = await verifyPassword(password, user.password_hash);
  else await verifyPassword(password, await getDummyHash());

  if (!user || !ok) {
    hit(pairKey, TEN_MINUTES);
    hit(ipKey, TEN_MINUTES);
    throw unauthorized(BAD_CREDENTIALS);
  }

  clearLimit(pairKey);
  await startSession(user.id);
  return json({ user: toPublicUser(user) });
});
