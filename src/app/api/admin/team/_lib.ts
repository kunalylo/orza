/**
 * Shared helpers for the admin team routes (super admin only). Not a route — Next only routes `route.ts`.
 */
import { randomInt } from "crypto";
import { adminRoleOf } from "@/lib/auth";
import { badRequest } from "@/lib/http";
import type { AdminRole, User } from "@/lib/types";

/** One admin as the Team page lists it. Explicit allow-list — never spread the stored user document. */
export type AdminRow = {
  id: string;
  name: string;
  email: string;
  admin_role: AdminRole;
  created_at: string;
  /** When their most recent signed-in session started (absent when they have none right now). */
  last_sign_in?: string;
};

export function toAdminRow(u: User, lastSignIn?: string): AdminRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    admin_role: adminRoleOf(u) ?? "sub",
    created_at: u.created_at,
    ...(lastSignIn ? { last_sign_in: lastSignIn } : {}),
  };
}

/* ───────────────────────── Generated passwords ───────────────────────── */

// No look-alike characters: I, l, 1, O and 0 are left out (o too, so it can't be read as 0).
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "@#%+=?!";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const pick = (set: string) => set[randomInt(set.length)];

/**
 * A strong random password (default 14 characters, cryptographically random) with at least one
 * upper-case letter, lower-case letter, digit and symbol, and no look-alike characters.
 */
export function generatePassword(length = 14): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  // Fisher–Yates shuffle so the guaranteed characters aren't always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/** Validates the `[id]` route param. */
export function adminIdParam(id: string | undefined): string {
  if (!id || id.length > 100) throw badRequest("Invalid admin id");
  return id;
}
