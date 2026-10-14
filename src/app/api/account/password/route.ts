import { z } from "zod";
import { getSessionId, hashPassword, requireUser, revokeAllSessions, verifyPassword } from "@/lib/auth";
import { col, nowISO } from "@/lib/db";
import { BODY_LIMIT_SMALL, HttpError, json, parseBody, route, unauthorized } from "@/lib/http";
import { clearLimit, reserve, tooManyRequests } from "@/lib/rate-limit";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    current_password: z
      .string({ required_error: "Enter your current password" })
      .min(1, "Enter your current password")
      .max(128, "Current password is incorrect"),
    new_password: z
      .string({ required_error: "Choose a new password" })
      .min(8, "New password must be at least 8 characters")
      .max(128, "New password must be 128 characters or fewer"),
  })
  .refine((b) => b.new_password !== b.current_password, {
    message: "Choose a new password that's different from your current one",
    path: ["new_password"],
  });

/** Wrong current-password attempts allowed per account before a cool-down. */
const ATTEMPTS = { limit: 5, windowMs: 15 * 60 * 1000 };

/** `code` of the 401 for a wrong current password (an expired session's 401 has code "unauthorized"). */
const WRONG_PASSWORD = "wrong_password";

/**
 * POST /api/account/password {current_password, new_password} (any signed-in user) → {ok:true}
 * Checks the current password (401 `{error: "Current password is incorrect", code: "wrong_password"}`;
 * 429 `rate_limited` after 5 wrong tries in 15 minutes), saves the new one, and signs out every other
 * device — this browser stays signed in.
 *
 * Note for clients: `api` from `@/lib/api-client` sends a 401 to /login unless its code is
 * "wrong_password", so both `api.post` and a plain `fetch` (as ChangePasswordForm and PasswordSection do) work.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { current_password, new_password } = await parseBody(req, Body, { maxBytes: BODY_LIMIT_SMALL });

  // Reserve the attempt before the (slow) bcrypt check, so parallel guesses can't all slip through.
  const key = `password-change:${user.id}`;
  const wait = reserve([{ key, ...ATTEMPTS }]);
  if (wait) return tooManyRequests(wait, "Too many password attempts.");

  if (!user.password_hash || !(await verifyPassword(current_password, user.password_hash))) {
    // Distinct code so clients can tell a wrong password from an expired session (both are 401).
    throw new HttpError(401, "Current password is incorrect", WRONG_PASSWORD);
  }
  clearLimit(key);

  const { matched } = await col<User>("users").updateOne(
    { id: user.id },
    { $set: { password_hash: await hashPassword(new_password), updated_at: nowISO() } }
  );
  if (!matched) throw unauthorized();
  // Anyone who knew the old password is signed out; this browser keeps its session.
  const current = await getSessionId();
  await revokeAllSessions(user.id, current ? { except: current } : {});

  return json({ ok: true });
});
