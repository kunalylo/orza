import { requireUser, toPublicUser } from "@/lib/auth";
import { col, type CollectionName } from "@/lib/db";
import { dateInTz } from "@/lib/dates";
import { route } from "@/lib/http";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Every per-user collection, keyed by its name in the export file. */
const USER_COLLECTIONS: { key: string; name: CollectionName; sort: string }[] = [
  { key: "meals", name: "meals", sort: "created_at" },
  { key: "scans", name: "scans", sort: "created_at" },
  { key: "tracking", name: "tracking", sort: "date" },
  { key: "chat_sessions", name: "chat_sessions", sort: "created_at" },
  { key: "chat_messages", name: "chat_messages", sort: "created_at" },
  { key: "goals", name: "goals", sort: "created_at" },
  { key: "compensation_plans", name: "compensation_plans", sort: "created_at" },
  { key: "recipes", name: "recipes", sort: "created_at" },
  { key: "credit_transactions", name: "credit_transactions", sort: "created_at" },
  { key: "onboarding", name: "onboarding", sort: "updated_at" },
];

/**
 * GET /api/account/export → JSON attachment with everything ÖRZA stores about the signed-in user
 * (the public user record plus all their meals, scans, tracking, chats, goals, plans, recipes,
 * credit history, credit requests and onboarding answers). Never includes the password hash.
 */
export const GET = route(async () => {
  const user = await requireUser();

  const entries = await Promise.all(
    USER_COLLECTIONS.map(async ({ key, name, sort }) => {
      const rows = await col<{ id: string }>(name).find({ user_id: user.id }, { sort: { [sort]: 1 } });
      return [key, rows] as const;
    })
  );
  // "Request more credits" messages sent from inside the account (stored as leads by email).
  const creditRequests = await col<{ id: string }>("leads").find(
    { email: (user.email || "").toLowerCase(), source: "credits-request" },
    { sort: { created_at: 1 } }
  );
  entries.push(["credit_requests", creditRequests]);
  const data = Object.fromEntries(entries);

  const payload = {
    export: {
      app: SITE.name,
      format_version: 1,
      generated_at: new Date().toISOString(),
      note: "This file contains all the personal data ÖRZA stores for your account. Keep it somewhere safe.",
      counts: Object.fromEntries(entries.map(([k, rows]) => [k, rows.length])),
    },
    user: toPublicUser(user),
    ...data,
  };

  const filename = `orza-data-${dateInTz(user.profile?.timezone)}.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
