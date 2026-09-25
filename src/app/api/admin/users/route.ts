import { z } from "zod";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { col, usingMongo, type Filter } from "@/lib/db";
import { json, route } from "@/lib/http";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().trim().max(100, "Search must be 100 characters or fewer").default(""),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Explicit allow-list of fields — never spread the stored document (it holds the password hash). */
function toRow(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    credits: u.credits ?? 0,
    onboarding_complete: !!u.onboarding_complete,
    created_at: u.created_at,
    is_admin: isAdmin(u),
  };
}

/**
 * GET /api/admin/users?q=&limit= (admin only) → {users, total}
 * Searches every member by name or email (case-insensitive, anywhere in the text). An exact email
 * match is always listed first; the rest are newest first. `total` (additive) is how many members
 * match in all, before `limit` is applied.
 */
export const GET = route(async (req: Request) => {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const { q, limit } = Query.parse({ q: params.get("q") ?? undefined, limit: params.get("limit") ?? undefined });
  const users = col<User>("users");
  const newestFirst = { created_at: -1 } as const;
  const headers = { "Cache-Control": "no-store" };

  if (!q) {
    const [rows, total] = await Promise.all([users.find({}, { sort: newestFirst, limit }), users.countDocuments({})]);
    return json({ users: rows.map(toRow), total }, { headers });
  }

  const needle = q.toLowerCase();
  // Emails are stored lowercase + trimmed, so an exact match is a single lookup on the unique index.
  const exact = needle.includes("@") ? await users.findOne({ email: needle }) : null;

  let matches: User[];
  let total: number;
  if (usingMongo()) {
    // Server-side search over the whole collection. The input is escaped, so it is matched literally.
    const rx = { $regex: escapeRegex(q), $options: "i" };
    const filter: Filter = { $or: [{ email: rx }, { name: rx }] };
    [matches, total] = await Promise.all([users.find(filter, { sort: newestFirst, limit }), users.countDocuments(filter)]);
  } else {
    // Local development store (a JSON file): filter in code.
    const all = await users.find({}, { sort: newestFirst });
    const hit = all.filter((u) => (u.email || "").toLowerCase().includes(needle) || (u.name || "").toLowerCase().includes(needle));
    matches = hit.slice(0, limit);
    total = hit.length;
  }

  const rows = exact ? [exact, ...matches.filter((u) => u.id !== exact.id)].slice(0, limit) : matches;
  return json({ users: rows.map(toRow), total: Math.max(total, rows.length) }, { headers });
});
