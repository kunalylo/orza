import { z } from "zod";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { col } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

const SCAN_LIMIT = 500;

const Query = z.object({
  q: z.string().trim().max(100, "Search must be 100 characters or fewer").default(""),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * GET /api/admin/users?q=&limit= (admin only) → {users, total}
 * Looks at the newest 500 users and filters by name/email in code (simple, no regex from user input).
 * `total` (additive) is how many of those matched before `limit` was applied.
 */
export const GET = route(async (req: Request) => {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const { q, limit } = Query.parse({ q: params.get("q") ?? undefined, limit: params.get("limit") ?? undefined });

  const newest = await col<User>("users").find({}, { sort: { created_at: -1 }, limit: SCAN_LIMIT });
  const needle = q.toLowerCase();
  const matched = needle
    ? newest.filter((u) => (u.email || "").toLowerCase().includes(needle) || (u.name || "").toLowerCase().includes(needle))
    : newest;

  // Explicit allow-list of fields — never spread the stored document (it holds the password hash).
  const users = matched.slice(0, limit).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    credits: u.credits ?? 0,
    onboarding_complete: !!u.onboarding_complete,
    created_at: u.created_at,
    is_admin: isAdmin(u),
  }));

  return json({ users, total: matched.length }, { headers: { "Cache-Control": "no-store" } });
});
