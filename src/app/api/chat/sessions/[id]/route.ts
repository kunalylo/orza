import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getOwnedSession, messagesCol, sessionsCol } from "../../_shared";

/** DELETE /api/chat/sessions/[id] — removes a conversation and its messages. Meals it logged stay in the meal log. */
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const session = await getOwnedSession(user.id, id);
  await messagesCol().deleteMany({ session_id: session.id, user_id: user.id });
  await sessionsCol().deleteOne({ id: session.id, user_id: user.id });
  return json({ ok: true });
});
