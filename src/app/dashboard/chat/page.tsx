"use client";
import { Suspense } from "react";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import { ChatView } from "@/components/chat/ChatView";

/** Ask ÖRZA — chat or speak in English / Hindi / Hinglish; logs meals, suggests food, reports on the day. `?session=` opens a conversation. */
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatView />
    </Suspense>
  );
}
