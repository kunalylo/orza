"use client";
import * as React from "react";
import Link from "next/link";
import { BookmarkCheck, MessageSquareText, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/orza/primitives";
import { cn } from "@/lib/utils";
import { sessionStamp } from "./format";
import type { ChatSession } from "./types";

/** Conversations list — the desktop side pane and the mobile drawer share it. */
export function SessionList({
  sessions,
  error,
  activeId,
  memoryCount,
  onSelect,
  onNew,
  onDelete,
  onRetry,
  inDrawer = false,
}: {
  sessions: ChatSession[] | null;
  error: string | null;
  activeId: string | null;
  memoryCount: number;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (s: ChatSession) => void;
  onRetry: () => void;
  inDrawer?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex items-center justify-between gap-3", inDrawer ? "pb-4" : "px-4 pb-3 pt-4")}>
        {!inDrawer && <Eyebrow className="text-[11px]">Conversations</Eyebrow>}
        <Button size="sm" onClick={onNew} className={cn(inDrawer && "w-full")}>
          <Plus className="h-4 w-4" aria-hidden /> New chat
        </Button>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto no-scrollbar", !inDrawer && "px-2 pb-2")}>
        {sessions === null ? (
          <div className="space-y-1.5 px-1 py-1" aria-label="Loading conversations">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-orza-sm px-3 py-2.5">
                <div className="orza-skeleton h-3.5 w-[78%] rounded-full" />
                <div className="orza-skeleton mt-2 h-2.5 w-[34%] rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center text-sm text-orza-muted">
            <p>{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-orza-muted shadow-orza-glass">
              <MessageSquareText className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium text-orza-strong">No conversations yet</p>
            <p className="mt-1 text-xs leading-relaxed text-orza-muted">Say hello, or tell ÖRZA what you ate — your chats will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-0.5" aria-label="Your conversations">
            {sessions.map((s) => {
              const active = s.id === activeId;
              return (
                <li key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "w-full rounded-orza-sm border py-2.5 pl-3 pr-11 text-left transition-colors duration-150 ease-orza",
                      active
                        ? "border-[rgba(20,20,20,0.08)] bg-white/90 shadow-[0_6px_18px_rgba(20,20,20,0.06)]"
                        : "border-transparent hover:bg-white/60"
                    )}
                  >
                    <span className={cn("block truncate text-[14px]", active ? "font-medium text-orza-strong" : "text-orza")}>{s.title || "New chat"}</span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-orza-subtle">{sessionStamp(s.updated_at)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    aria-label={`Delete conversation “${s.title || "New chat"}”`}
                    className={cn(
                      "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-orza-subtle transition-[opacity,background-color,color] duration-150 ease-orza hover:bg-[#FDECEC] hover:text-[#B02C2C] focus-visible:opacity-100",
                      inDrawer ? "opacity-100" : "opacity-100 xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100"
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={cn("border-t border-[rgba(20,20,20,0.08)]", inDrawer ? "mt-4 pt-4" : "px-4 py-3")}>
        <Link
          href="/dashboard/settings"
          className="group flex items-center gap-2.5 rounded-orza-sm text-xs text-orza-muted transition-colors duration-150 ease-orza hover:text-orza-strong"
        >
          <BookmarkCheck className="h-4 w-4 shrink-0 text-[#6E3ED6]" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1">
            {memoryCount > 0
              ? `ÖRZA remembers ${memoryCount} ${memoryCount === 1 ? "thing" : "things"} about you`
              : "ÖRZA learns your preferences as you chat"}
          </span>
          <span className="font-medium underline-offset-2 group-hover:underline">Manage</span>
        </Link>
      </div>
    </div>
  );
}
