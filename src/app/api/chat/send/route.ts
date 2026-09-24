import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled, aiJSON } from "@/lib/ai";
import {
  COACH_REPLY_SHAPE,
  buildContext,
  chatTitle,
  coachSystemPrompt,
  extractFacts,
  mergeMemory,
  normaliseAiOutput,
  ruleBasedReply,
  type ChatMessageRecord,
  type HistoryTurn,
} from "@/lib/coach";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { createMeal, guessMealType } from "@/lib/domain/meals";
import { HttpError, json, parseBody, route } from "@/lib/http";
import type { ChatSession, Meal, User } from "@/lib/types";
import { DEFAULT_TITLE, currentCredits, getOwnedSession, messagesCol, recentMessages, sessionIdSchema, sessionsCol } from "../_shared";

const Body = z.object({
  message: z
    .string({ required_error: "Type a message for ÖRZA", invalid_type_error: "Message must be text" })
    .trim()
    .min(1, "Type a message for ÖRZA")
    .max(2000, "Please keep messages under 2,000 characters"),
  session_id: sessionIdSchema.nullish(),
});

/** How many earlier messages the AI sees. */
const HISTORY_TURNS = 12;

/**
 * POST /api/chat/send — one turn of "Ask ÖRZA".
 * AI on: 1 credit (withCredits) for a JSON reply that may log a meal and learn durable facts.
 * AI off (or temporarily unavailable): the deterministic coach in lib/coach.ts, free.
 * The conversation is only created/written once a reply exists, so a 402 leaves nothing half-saved.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Body);
  const startedAt = Date.now();

  let session: ChatSession | null = body.session_id ? await getOwnedSession(user.id, body.session_id) : null;
  const [ctx, earlier] = await Promise.all([
    buildContext(user),
    session ? recentMessages(user.id, session.id, HISTORY_TURNS) : Promise.resolve([] as ChatMessageRecord[]),
  ]);

  let reply = "";
  let meal: Meal | null = null;
  let memoryAdd: string[] = [];
  let ai = false;
  let notice: string | undefined;
  let credits: number | undefined;

  if (aiEnabled()) {
    try {
      const history: HistoryTurn[] = earlier.map((m) => ({ role: m.role, content: m.content }));
      const out = await withCredits(
        user.id,
        "chat",
        async () => {
          const raw = await aiJSON({
            system: coachSystemPrompt(ctx, history),
            prompt: body.message,
            shape: COACH_REPLY_SHAPE,
            temperature: 0.5,
            maxTokens: 1000,
          });
          const parsed = normaliseAiOutput(raw, guessMealType(ctx.tz));
          if (!parsed) throw new HttpError(502, "ÖRZA's AI returned an empty answer.", "ai_empty");
          // Logged inside withCredits so a failed write refunds the credit.
          const logged = parsed.log_meal
            ? await createMeal({
                userId: user.id,
                date: parsed.log_meal.day === "yesterday" ? addDays(ctx.date, -1) : ctx.date,
                mealType: parsed.log_meal.meal_type,
                source: "chat",
                description: parsed.log_meal.description,
                items: parsed.log_meal.items,
              })
            : null;
          return { ...parsed, logged };
        },
        "Ask ÖRZA"
      );
      reply = out.reply;
      meal = out.logged;
      // Prefer the model's facts; fall back to the deterministic extractor ("I'm vegetarian", "mujhe dudh se allergy hai").
      memoryAdd = out.memory_add.length ? out.memory_add : extractFacts(body.message);
      ai = true;
    } catch (e) {
      // 402 (no credits), validation and server errors propagate; only AI outages fall back to the free coach.
      if (!(e instanceof HttpError) || e.status < 502 || e.status > 504) throw e;
      notice = "ÖRZA's AI was unavailable, so the built-in coach answered. No credits were used.";
    }
    credits = await currentCredits(user.id);
  }

  if (!ai) {
    const r = await ruleBasedReply(user, ctx, body.message);
    reply = r.reply;
    meal = r.meal;
    memoryAdd = r.memory_add;
  }

  // Durable facts → user.memory (deduped, newest kept, max 30).
  const before = Array.isArray(user.memory) ? user.memory : [];
  const merged = mergeMemory(before, memoryAdd, 30);
  const known = new Set(before);
  const remembered = merged.filter((f) => !known.has(f));
  if (remembered.length) {
    await col<User>("users").updateOne({ id: user.id }, { $set: { memory: merged, updated_at: nowISO() } });
  }

  // Timestamps: the user's message is stamped when it arrived; the reply strictly after it.
  const userAt = new Date(startedAt).toISOString();
  const replyAt = new Date(Math.max(Date.now(), startedAt + 1)).toISOString();

  if (!session) {
    session = { id: newId(), user_id: user.id, title: chatTitle(body.message), created_at: userAt, updated_at: replyAt };
    await sessionsCol().insertOne(session);
  } else {
    const set: Partial<ChatSession> = { updated_at: replyAt };
    if (!earlier.length && (!session.title || session.title === DEFAULT_TITLE)) set.title = chatTitle(body.message);
    await sessionsCol().updateOne({ id: session.id, user_id: user.id }, { $set: set });
    session = { ...session, ...set };
  }

  const userMessage: ChatMessageRecord = {
    id: newId(),
    session_id: session.id,
    user_id: user.id,
    role: "user",
    content: body.message,
    created_at: userAt,
  };
  const message: ChatMessageRecord = {
    id: newId(),
    session_id: session.id,
    user_id: user.id,
    role: "assistant",
    content: reply,
    meta: {
      ai,
      ...(meal ? { logged_meal_id: meal.id } : {}),
      ...(remembered.length ? { remembered } : {}),
    },
    created_at: replyAt,
  };
  await messagesCol().insertOne(userMessage);
  await messagesCol().insertOne(message);

  return json({
    session_id: session.id,
    session,
    user_message: userMessage,
    message,
    ...(meal ? { logged_meal: meal } : {}),
    ...(credits != null ? { credits } : {}),
    ...(remembered.length ? { memory: merged, remembered } : {}),
    ...(notice ? { notice } : {}),
  });
});
