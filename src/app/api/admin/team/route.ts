import { z } from "zod";
import { hashPassword, requireSuperAdmin } from "@/lib/auth";
import { DEFAULT_TZ } from "@/lib/dates";
import { col, newId, nowISO } from "@/lib/db";
import { DEFAULT_TARGETS } from "@/lib/domain/targets";
import { BODY_LIMIT_SMALL, HttpError, json, parseBody, route } from "@/lib/http";
import type { Session, User } from "@/lib/types";
import { generatePassword, toAdminRow } from "./_lib";

export const dynamic = "force-dynamic";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const Body = z.object({
  name: z
    .string({ required_error: "Enter their name" })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, "Enter their name").max(60, "Keep the name under 60 characters")),
  email: z
    .string({ required_error: "Enter their email" })
    .trim()
    .toLowerCase()
    .min(1, "Enter their email")
    .max(254, "That email is too long")
    .email("Enter a valid email address"),
  password: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be 128 characters or fewer")
      .optional()
  ),
});

const emailTaken = () => new HttpError(409, "An account with this email already exists. Use a different email for the staff account.", "email_taken");

/**
 * GET /api/admin/team (super admin only) → {admins:[{id, name, email, admin_role, created_at, last_sign_in?}]}
 * Every admin account, super admins first, then oldest first. `last_sign_in` is when their most recent
 * session started (absent when they're signed out everywhere).
 */
export const GET = route(async () => {
  await requireSuperAdmin();
  const admins = await col<User>("users").find({ is_admin: true }, { sort: { created_at: 1 }, limit: 500 });
  const ids = admins.map((a) => a.id);
  const sessions = ids.length
    ? await col<Session>("sessions").find({ user_id: { $in: ids } }, { sort: { created_at: -1 }, limit: 2000 })
    : [];
  const latest = new Map<string, string>();
  for (const s of sessions) if (!latest.has(s.user_id)) latest.set(s.user_id, s.created_at);

  const rows = admins.map((a) => toAdminRow(a, latest.get(a.id)));
  rows.sort((a, b) => (a.admin_role === b.admin_role ? 0 : a.admin_role === "super" ? -1 : 1));
  return json({ admins: rows }, { headers: { "Cache-Control": "no-store" } });
});

/**
 * POST /api/admin/team {name, email, password?} (super admin only) → 201 {admin, password, generated}
 * Creates a NEW staff account with the sub-admin role (409 when the email is already registered).
 * Without a password a strong 14-character one is generated. The password is returned this once so
 * the super admin can hand it over; it is stored only as a bcrypt hash.
 */
export const POST = route(async (req: Request) => {
  const owner = await requireSuperAdmin();
  const { name, email, password: chosen } = await parseBody(req, Body, { maxBytes: BODY_LIMIT_SMALL });

  const users = col<User>("users");
  if (await users.findOne({ email })) throw emailTaken();

  const password = chosen ?? generatePassword();
  const now = nowISO();
  const admin: User = {
    id: newId(),
    email,
    name,
    password_hash: await hashPassword(password),
    created_at: now,
    updated_at: now,
    // Staff accounts never onboard and never use the member app (or its credits).
    onboarding_complete: true,
    is_admin: true,
    admin_role: "sub",
    credits: 0,
    profile: { timezone: DEFAULT_TZ },
    targets: { ...DEFAULT_TARGETS },
    preferences: { units: "metric", reminders: false, weekly_report: false, tone: "gentle" },
    memory: [],
  };

  try {
    await users.insertOne(admin);
  } catch (e: any) {
    // Unique email index (Mongo): someone registered this email at the same moment.
    if (e?.code === 11000) throw emailTaken();
    throw e;
  }

  console.info("[orza] admin created", { by: owner.id, admin_id: admin.id, role: "sub" });
  return json({ admin: toAdminRow(admin), password, generated: !chosen }, 201);
});
