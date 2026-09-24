/** Shared helpers for the /api/chat/* routes (not a route itself). */
import { z } from "zod";
import { col } from "@/lib/db";
import { notFound } from "@/lib/http";
import type { ChatMessageRecord } from "@/lib/coach";
import type { ChatSession, Meal, User } from "@/lib/types";

export const DEFAULT_TITLE = "New chat";

export const sessionsCol = () => col<ChatSession>("chat_sessions");
export const messagesCol = () => col<ChatMessageRecord>("chat_messages");

export const sessionIdSchema = z
  .string({ required_error: "session_id is required", invalid_type_error: "session_id must be a string" })
  .trim()
  .min(1, "session_id is required")
  .max(64, "session_id looks invalid");

/** The user's own session, or 404 (never reveals whether someone else's id exists). */
export async function getOwnedSession(userId: string, id: string): Promise<ChatSession> {
  const parsed = sessionIdSchema.safeParse(id);
  if (!parsed.success) throw notFound("Conversation not found");
  const session = await sessionsCol().findOne({ id: parsed.data, user_id: userId });
  if (!session) throw notFound("Conversation not found");
  return session;
}

/** Last `limit` messages of a session, oldest first. */
export async function recentMessages(userId: string, sessionId: string, limit: number): Promise<ChatMessageRecord[]> {
  const latest = await messagesCol().find({ session_id: sessionId, user_id: userId }, { sort: { created_at: -1 }, limit });
  return latest.reverse();
}

/** Meals referenced by `meta.logged_meal_id`, keyed by id (deleted meals are simply absent). */
export async function loggedMealsFor(userId: string, messages: ChatMessageRecord[]): Promise<Record<string, Meal>> {
  const ids = Array.from(new Set(messages.map((m) => m.meta?.logged_meal_id).filter((id): id is string => !!id)));
  if (!ids.length) return {};
  const meals = await col<Meal>("meals").find({ user_id: userId, id: { $in: ids } });
  return Object.fromEntries(meals.map((m) => [m.id, m]));
}

/** Fresh credit balance after a credit-spending call. */
export async function currentCredits(userId: string): Promise<number | undefined> {
  return (await col<User>("users").findOne({ id: userId }))?.credits;
}
