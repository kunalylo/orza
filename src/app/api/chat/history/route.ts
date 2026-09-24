import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getOwnedSession, loggedMealsFor, recentMessages, sessionIdSchema } from "../_shared";

const Query = z.object({ session_id: sessionIdSchema });

/**
 * GET /api/chat/history?session_id= — the conversation's latest 200 messages, oldest first.
 * `logged_meals` maps meta.logged_meal_id → meal, for the inline "Logged: …" cards.
 */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const { session_id } = Query.parse({ session_id: new URL(req.url).searchParams.get("session_id") ?? undefined });
  const session = await getOwnedSession(user.id, session_id);
  const messages = await recentMessages(user.id, session.id, 200);
  const logged_meals = await loggedMealsFor(user.id, messages);
  return json({ session, messages, logged_meals });
});
