import { hashPassword, startMobileSession, startSession, toPublicUser } from "@/lib/auth";
import { INITIAL_CREDITS } from "@/lib/credits";
import { DEFAULT_TZ } from "@/lib/dates";
import { col, newId, nowISO } from "@/lib/db";
import { DEFAULT_TARGETS } from "@/lib/domain/targets";
import { HttpError, json, route } from "@/lib/http";
import { mobileClientFrom } from "@/lib/session-token";
import type { CreditTransaction, User } from "@/lib/types";
import { TEN_MINUTES, assertSameOriginJson, clientIp, parseAuthBody, registerSchema, reserve, tooManyRequests } from "../_lib";

export const dynamic = "force-dynamic";

const emailTaken = () => new HttpError(409, "An account with this email already exists. Try signing in instead.", "email_taken");

/**
 * POST /api/auth/register {name, email, password} → 201 {user} + session cookie.
 * With `X-ORZA-Client: mobile` (the ÖRZA phone app; optional `X-ORZA-Device`, `X-ORZA-Platform`)
 * → 201 {user, token}: an app session whose token is sent as `Authorization: Bearer`; no cookies.
 */
export const POST = route(async (req: Request) => {
  // Cross-site / non-JSON posts are refused before they can use up the network's sign-up budget.
  assertSameOriginJson(req);
  // Loose per-IP cap on sign-ups (counts every attempt; generous for shared office/campus networks).
  const wait = reserve([{ key: `register:${clientIp(req)}`, limit: 20, windowMs: TEN_MINUTES }]);
  if (wait) return tooManyRequests(wait, "Too many sign-up attempts from this network.");

  const parsed = await parseAuthBody(req, registerSchema);
  if (parsed.error) return parsed.error;
  const { name, email, password } = parsed.data;

  const users = col<User>("users");
  if (await users.findOne({ email })) throw emailTaken();

  const now = nowISO();
  const user: User = {
    id: newId(),
    email,
    name,
    password_hash: await hashPassword(password),
    created_at: now,
    updated_at: now,
    onboarding_complete: false,
    credits: INITIAL_CREDITS,
    profile: { timezone: DEFAULT_TZ },
    targets: { ...DEFAULT_TARGETS },
    preferences: { units: "metric", reminders: true, weekly_report: true, tone: "gentle" },
    memory: [],
  };

  try {
    await users.insertOne(user);
  } catch (e: any) {
    // Unique email index (Mongo) — a concurrent sign-up won the race.
    if (e?.code === 11000) throw emailTaken();
    throw e;
  }

  const welcome: CreditTransaction = {
    id: newId(),
    user_id: user.id,
    amount: INITIAL_CREDITS,
    reason: "Welcome credits",
    balance_after: INITIAL_CREDITS,
    created_at: now,
  };
  await col<CreditTransaction>("credit_transactions").insertOne(welcome);

  const mobile = mobileClientFrom(req.headers);
  if (mobile) {
    const { token } = await startMobileSession(user.id, mobile);
    return json({ user: toPublicUser(user), token }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }
  await startSession(user.id);
  return json({ user: toPublicUser(user) }, 201);
});
