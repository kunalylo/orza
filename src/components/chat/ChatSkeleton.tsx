import * as React from "react";
import { GlassCard } from "@/components/orza/primitives";

/**
 * Page frame: fills the viewport between the app shell's bars so only the conversation scrolls.
 * Mobile: 56px top bar + 24px top padding + ~64px bottom tabs (+ safe area). Desktop: 40px top padding.
 */
export const CHAT_FRAME =
  "-mb-12 flex h-[calc(100dvh-152px-env(safe-area-inset-bottom))] min-h-[440px] gap-5 lg:-mb-8 lg:h-[calc(100dvh-72px)]";

export function ChatSkeleton() {
  return (
    <div className={CHAT_FRAME} aria-busy="true" aria-label="Loading Ask ÖRZA">
      <GlassCard variant="subtle" padded={false} className="hidden w-[280px] shrink-0 flex-col p-4 xl:flex">
        <div className="flex items-center justify-between">
          <div className="orza-skeleton h-3 w-24 rounded-full" />
          <div className="orza-skeleton h-9 w-28 rounded-full" />
        </div>
        <div className="mt-5 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="orza-skeleton h-3.5 w-[80%] rounded-full" />
              <div className="orza-skeleton mt-2 h-2.5 w-[30%] rounded-full" />
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard padded={false} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[rgba(20,20,20,0.08)] px-4 py-3 sm:px-5">
          <div className="orza-skeleton h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <div className="orza-skeleton h-3.5 w-20 rounded-full" />
            <div className="orza-skeleton h-2.5 w-36 rounded-full" />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[780px] flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
          <div className="orza-skeleton h-12 w-[55%] self-end rounded-orza-md" />
          <div className="orza-skeleton h-24 w-[75%] rounded-orza-md" />
          <div className="orza-skeleton h-10 w-[40%] self-end rounded-orza-md" />
        </div>
        <div className="border-t border-[rgba(20,20,20,0.08)] px-3 py-3 sm:px-5 sm:py-4">
          <div className="orza-skeleton mx-auto h-12 w-full max-w-[780px] rounded-[24px]" />
        </div>
      </GlassCard>
    </div>
  );
}
