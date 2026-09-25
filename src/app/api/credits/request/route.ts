import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { newId, nowISO } from "@/lib/db";
import { BODY_LIMIT_SMALL, json, parseBody, route } from "@/lib/http";
import { CREDIT_REQUEST_MESSAGE_MAX } from "@/components/account/options";
import {
  CREDIT_REQUEST_SOURCE_PREFIX,
  CREDIT_REQUEST_TYPE,
  CREDIT_REQUESTS_PER_DAY,
  creditRequests,
  toOwnView,
  type CreditRequestDoc,
} from "../requests";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MESSAGE = "Please top up my AI credits.";

const Body = z.object({
  message: z
    .string({ invalid_type_error: "Message must be text" })
    .max(CREDIT_REQUEST_MESSAGE_MAX + 200, `Message must be ${CREDIT_REQUEST_MESSAGE_MAX} characters or fewer`)
    .transform((s) => s.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().max(CREDIT_REQUEST_MESSAGE_MAX, `Message must be ${CREDIT_REQUEST_MESSAGE_MAX} characters or fewer`))
    .optional(),
});

/** GET /api/credits/request → {requests, pending} — the signed-in member's recent credit requests, newest first. */
export const GET = route(async () => {
  const user = await requireUser();
  const rows = await creditRequests().find(
    { type: CREDIT_REQUEST_TYPE, user_id: user.id },
    { sort: { created_at: -1 }, limit: 10 }
  );
  const requests = rows.map(toOwnView);
  return json(
    { requests, pending: requests.find((r) => r.status === "open") ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
});

/**
 * POST /api/credits/request {message?} → {request}
 * Sends a "Request more credits" message to the team from the signed-in account. The account's
 * email, name and current balance are recorded server-side; every request is kept (never overwritten).
 * 429 `rate_limited` after CREDIT_REQUESTS_PER_DAY requests in 24 hours.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const { message } = await parseBody(req, Body, { maxBytes: BODY_LIMIT_SMALL });

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const recent = await creditRequests().countDocuments({
    type: CREDIT_REQUEST_TYPE,
    user_id: user.id,
    created_at: { $gte: since },
  });
  if (recent >= CREDIT_REQUESTS_PER_DAY) {
    return json(
      {
        error: "You've already sent a few requests today. The team will reply by email soon.",
        code: "rate_limited",
      },
      { status: 429 }
    );
  }

  const now = nowISO();
  const id = newId();
  const doc: CreditRequestDoc = {
    id,
    type: CREDIT_REQUEST_TYPE,
    source: `${CREDIT_REQUEST_SOURCE_PREFIX}:${id}`,
    user_id: user.id,
    email: (user.email || "").toLowerCase(),
    name: user.name || "",
    message: message || DEFAULT_MESSAGE,
    balance: Math.max(0, user.credits ?? 0),
    status: "open",
    created_at: now,
    updated_at: now,
  };
  await creditRequests().insertOne(doc);
  console.info("[orza] credit request", { user_id: user.id, request_id: id, balance: doc.balance });

  return json({ request: toOwnView(doc) }, { status: 201 });
});
