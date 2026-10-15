import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { aiEnabled, aiJSON } from "@/lib/ai";
import {
  COACH_REPLY_SHAPE,
  buildContext,
  chatTitle,
  coachSystemPrompt,
  extractFacts,
  learnFacts,
  normaliseAiOutput,
  ruleBasedReply,
  type ChatMessageRecord,
  type HistoryTurn,
  type LearnedFacts,
} from "@/lib/coach";
import { MEMORY_MAX_ITEMS } from "@/components/account/options";
import { AI_GUARD, emptyResultCreditNote, refundEmptyResult, reserveAi } from "@/lib/ai-guard";
import { withCredits } from "@/lib/credits";
import { col, newId, nowISO } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { createMeal, guessMealType } from "@/lib/domain/meals";
import { HttpError, json, parseBody, route } from "@/lib/http";
import type { ChatSession, Meal, User } from "@/lib/types";
import { DEFAULT_TITLE, currentCredits, getOwnedSession, messagesCol, recentMessages, sessionIdSchema, sessionsCol } from "../_shared";

/** Room for the AI's own timeout (text AI ≤ 45 s + the built-in fallback and DB writes) so a slow answer still reaches the fallback instead of a platform 504. */
export const maxDuration = 60;

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
/** Attempts at the conditional memory write before giving up (only contended by edits made during this turn). */
const SAVE_ATTEMPTS = 4;

/** Mongo filter matching a field's exact current value (or its absence). */
const sameAs = (v: unknown) => (v === undefined ? { $exists: false } : v);

/**
 * Stores facts learned this turn. The AI call can take many seconds, and meanwhile the user may edit
 * Settings → Memory or their allergies (or chat in another tab), so this re-reads the user and writes only
 * if memory and allergies are still what it merged into — otherwise it re-reads and merges again.
 * A deleted memory therefore never comes back, and facts learned in parallel are never dropped.
 */
async function saveLearnedFacts(userId: string, add: string[]): Promise<LearnedFacts | null> {
  const users = col<User>("users");
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    const fresh = await users.findOne({ id: userId });
    if (!fresh) return null;
    const learned = learnFacts(fresh.memory, fresh.profile?.allergies, add, MEMORY_MAX_ITEMS);
    if (!learned.remembered.length) return null;
    const $set: Record<string, unknown> = { memory: learned.memory, updated_at: nowISO() };
    if (learned.allergies) $set["profile.allergies"] = learned.allergies;
    const r = await users.updateOne(
      { id: userId, memory: sameAs(fresh.memory), "profile.allergies": sameAs(fresh.profile?.allergies) },
      { $set }
    );
    if (r.matched) return learned;
  }
  console.warn("[chat/send] memory changed during every save attempt; learned facts were not stored");
  return null;
}

/**
 * POST /api/chat/send — one turn of "Ask ÖRZA".
 * AI on: 1 credit (withCredits) for a JSON reply that may log a meal and learn durable facts. Refunded
 * when the AI fails; an empty answer is refunded only within the daily allowance (see @/lib/ai-guard).
 * AI off, temporarily unavailable, or over the per-user rate budget: the deterministic coach in
 * lib/coach.ts, free.
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
    // Per-user rate + concurrency budget (see @/lib/ai-guard); over it, the free built-in coach answers.
    const release = await reserveAi(user.id, "chat");
    if (!release) {
      notice = "You're sending messages faster than ÖRZA's AI can keep up, so the built-in coach answered this one (free).";
    } else {
      try {
        const history: HistoryTurn[] = earlier.map((m) => ({ role: m.role, content: m.content }));
        // Only AI failures (and a failed meal write) throw in here, so only they are refunded by withCredits.
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
            if (!parsed) return null; // a completed but unusable answer — handled below
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
          AI_GUARD.chat.reason
        );
        if (out) {
          reply = out.reply;
          meal = out.logged;
          // Trust the model's judgement of what is durable. Only when it learned nothing do the high-precision
          // safety patterns (diet, allergy, intolerance) still apply, so "mujhe dudh se allergy hai" is never lost.
          memoryAdd = out.memory_add.length ? out.memory_add : extractFacts(body.message, { safetyOnly: true });
          ai = true;
        } else {
          // The AI ran (and was paid for) but its answer was empty — refund within the daily allowance only.
          const refunded = await refundEmptyResult(user.id, "chat");
          notice = `ÖRZA's AI didn't give a usable answer, so the built-in coach replied. ${emptyResultCreditNote("chat", refunded)}`;
        }
      } catch (e) {
        // 402 (no credits), validation and server errors propagate; only AI outages fall back to the free coach.
        if (!(e instanceof HttpError) || e.status < 502 || e.status > 504) throw e;
        notice = "ÖRZA's AI was unavailable, so the built-in coach answered. No credits were used.";
      } finally {
        release();
      }
    }
    credits = await currentCredits(user.id);
  }

  if (!ai) {
    const r = await ruleBasedReply(user, ctx, body.message);
    reply = r.reply;
    meal = r.meal;
    memoryAdd = r.memory_add;
  }

  // Durable facts → user.memory; food allergies also → profile.allergies (see learnFacts).
  const learned = memoryAdd.length ? await saveLearnedFacts(user.id, memoryAdd) : null;
  const remembered = learned?.remembered ?? [];

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
    ...(learned && remembered.length ? { memory: learned.memory, remembered } : {}),
    ...(learned?.allergies ? { allergies: learned.allergies } : {}),
    ...(notice ? { notice } : {}),
  });
});
