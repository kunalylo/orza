import { hashPassword, startMobileSession, startSession, toPublicUser, verifyPassword } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, route, unauthorized } from "@/lib/http";
import { mobileClientFrom } from "@/lib/session-token";
import type { User } from "@/lib/types";
import {
  ONE_HOUR,
  TEN_MINUTES,
  assertSameOriginJson,
  clearLimit,
  clientIp,
  loginSchema,
  parseAuthBody,
  peek,
  release,
  reserve,
  tooManyRequests,
} from "../_lib";

export const dynamic = "force-dynamic";

const BAD_CREDENTIALS = "Incorrect email or password";

// Compared against when the email is unknown so both paths take the same time (no account enumeration by timing).
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ||= hashPassword("orza-timing-equaliser-not-a-password"));

/**
 * POST /api/auth/login {email, password} → {user} + session cookie; generic 401 on bad credentials.
 * The ÖRZA phone app sends `X-ORZA-Client: mobile` (optional `X-ORZA-Device`, `X-ORZA-Platform`) and
 * gets `{user, token}` instead — an app session whose token it sends as `Authorization: Bearer`; no cookies.
 */
export const POST = route(async (req: Request) => {
  assertSameOriginJson(req);
  const ip = clientIp(req);
  const ipKey = `login-ip:${ip}`; // 50 attempts / 10 min per IP (credential stuffing)
  // A network that is already throttled is refused before its request body is read or parsed.
  const ipWait = peek([{ key: ipKey, limit: 50, windowMs: TEN_MINUTES }]);
  if (ipWait) return tooManyRequests(ipWait, "Too many sign-in attempts.");

  const parsed = await parseAuthBody(req, loginSchema);
  if (parsed.error) return parsed.error;
  const { email, password } = parsed.data;

  const pairKey = `login:${ip}|${email}`; // 10 attempts / 10 min per IP + email
  // Per account, whatever the IP — holds even if the client IP can't be trusted or is rotated.
  // Counted for unknown emails too, so a 429 never reveals whether an account exists.
  const accountKey = `login-acct:${email}`;

  // Reserve the attempt before any await, so a burst of parallel requests can't all pass the check.
  const wait = reserve([
    { key: pairKey, limit: 10, windowMs: TEN_MINUTES },
    { key: ipKey, limit: 50, windowMs: TEN_MINUTES },
    { key: accountKey, limit: 25, windowMs: ONE_HOUR },
  ]);
  if (wait) return tooManyRequests(wait, "Too many sign-in attempts.");

  const user = await col<User>("users").findOne({ email });
  let ok = false;
  if (user?.password_hash) ok = await verifyPassword(password, user.password_hash);
  else await verifyPassword(password, await getDummyHash());

  if (!user || !ok) throw unauthorized(BAD_CREDENTIALS);

  // Successful sign-in: reset this person's failure budget and give the network its attempt back.
  clearLimit(pairKey);
  clearLimit(accountKey);
  release(ipKey);
  const mobile = mobileClientFrom(req.headers);
  if (mobile) {
    const { token } = await startMobileSession(user.id, mobile);
    return json({ user: toPublicUser(user), token }, { headers: { "Cache-Control": "no-store" } });
  }
  await startSession(user.id);
  return json({ user: toPublicUser(user) });
});
