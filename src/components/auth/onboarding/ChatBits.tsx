"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/** ÖRZA's avatar: the brand's warm energy dot in a frosted ring. */
export function OrzaAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(20,20,20,0.10)] bg-white/85 shadow-orza-glass",
        className
      )}
    >
      <span className="h-3 w-3 rounded-full bg-orza-dot shadow-[0_0_12px_rgba(255,122,106,0.55)]" />
    </span>
  );
}

/** Paragraphs split on blank lines; single newlines kept (bullet lists). */
export function MessageText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className="space-y-2.5">
      {paragraphs.map((p, i) => (
        <p key={i} className="whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}

/** Enter animation for a chat row (skipped for restored history and reduced motion). */
export function ChatRow({
  from,
  instant,
  children,
  className,
}: {
  from: "assistant" | "user";
  instant?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const still = reduce || instant;
  return (
    <motion.div
      initial={still ? false : { opacity: 0, y: 10, x: from === "user" ? 8 : 0 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn("flex w-full gap-2.5", from === "user" ? "justify-end" : "justify-start", className)}
    >
      {children}
    </motion.div>
  );
}

export function AssistantBubble({ children, tone, className }: { children: React.ReactNode; tone?: "hint"; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-[20px] rounded-tl-md border px-4 py-3 text-[15px] leading-relaxed text-orza-strong backdrop-blur-orza sm:max-w-[80%]",
        tone === "hint"
          ? "border-[rgba(176,106,0,0.22)] bg-[rgba(255,244,230,0.88)] shadow-[0_8px_24px_rgba(176,106,0,0.08)]"
          : "border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.72)] shadow-orza-glass",
        className
      )}
    >
      {children}
    </div>
  );
}

export function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[80%] rounded-[20px] rounded-tr-md bg-[#141414] px-4 py-2.5 text-[15px] leading-relaxed text-orza-bg-0 shadow-orza-cta">
      {children}
    </div>
  );
}

/** "ÖRZA is typing" — three soft dots. */
export function TypingBubble() {
  const reduce = useReducedMotion();
  return (
    <ChatRow from="assistant">
      <OrzaAvatar className="mt-0.5" />
      <div
        role="status"
        className="inline-flex h-[46px] items-center gap-1.5 rounded-[20px] rounded-tl-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.72)] px-4 shadow-orza-glass backdrop-blur-orza"
      >
        <span className="sr-only">ÖRZA is typing</span>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="h-2 w-2 rounded-full bg-orza-subtle"
            animate={reduce ? { opacity: 0.6 } : { opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={reduce ? { duration: 0 } : { duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
          />
        ))}
      </div>
    </ChatRow>
  );
}

/** Loading placeholder shaped like the first couple of messages. */
export function ChatSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="flex gap-2.5">
        <div className="orza-skeleton h-8 w-8 shrink-0 rounded-full" />
        <div className="orza-skeleton h-[84px] w-[72%] max-w-[420px] rounded-[20px] rounded-tl-md" />
      </div>
      <div className="flex justify-end">
        <div className="orza-skeleton h-11 w-40 rounded-[20px] rounded-tr-md" />
      </div>
      <div className="flex gap-2.5">
        <div className="orza-skeleton h-8 w-8 shrink-0 rounded-full" />
        <div className="orza-skeleton h-[60px] w-[58%] max-w-[360px] rounded-[20px] rounded-tl-md" />
      </div>
    </div>
  );
}
