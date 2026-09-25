import type { ChatMessageRecord } from "@/lib/coach";
import type { ChatSession, Meal } from "@/lib/types";

export type { ChatSession, Meal };

/** Message as returned by /api/chat/* (meta may carry `remembered` facts). */
export type ApiChatMessage = ChatMessageRecord;

export interface SessionsResponse {
  sessions: ChatSession[];
}

export interface HistoryResponse {
  session: ChatSession;
  messages: ApiChatMessage[];
  logged_meals?: Record<string, Meal>;
}

export interface SendResponse {
  session_id: string;
  session?: ChatSession;
  user_message: ApiChatMessage;
  message: ApiChatMessage;
  logged_meal?: Meal;
  credits?: number;
  /** Full memory list — present only when this turn taught ÖRZA something new. */
  memory?: string[];
  remembered?: string[];
  /** Updated profile allergies — present only when this turn learned a new food allergy. */
  allergies?: string[];
  notice?: string;
}

/** A rendered message: server messages plus optimistic / failed local ones. */
export interface UIMessage extends ApiChatMessage {
  status?: "sending" | "failed";
  loggedMeal?: Meal | null;
  notice?: string;
  /** Arrived during this visit (animate in); history loads render statically. */
  fresh?: boolean;
}
