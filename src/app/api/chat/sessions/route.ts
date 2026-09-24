import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { chatTitle } from "@/lib/coach";
import { newId, nowISO } from "@/lib/db";
import { badRequest, json, route } from "@/lib/http";
import type { ChatSession } from "@/lib/types";
import { DEFAULT_TITLE, sessionsCol } from "../_shared";

/** GET /api/chat/sessions — the user's conversations, most recently active first. */
export const GET = route(async () => {
  const user = await requireUser();
  const sessions = await sessionsCol().find({ user_id: user.id }, { sort: { updated_at: -1 }, limit: 50 });
  return json({ sessions });
});

const Body = z.object({
  title: z.string({ invalid_type_error: "title must be text" }).trim().max(200, "Title is too long").optional(),
});

/** POST /api/chat/sessions {title?} — start an empty conversation (the body is optional). */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const raw = await req.text();
  let data: unknown = {};
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw badRequest("Request body must be valid JSON");
    }
  }
  const body = Body.parse(data ?? {});
  const now = nowISO();
  const session: ChatSession = {
    id: newId(),
    user_id: user.id,
    title: body.title ? chatTitle(body.title) : DEFAULT_TITLE,
    created_at: now,
    updated_at: now,
  };
  await sessionsCol().insertOne(session);
  return json({ session }, 201);
});
