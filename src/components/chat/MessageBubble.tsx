"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowUpRight, BookmarkCheck, Check, Info, RotateCcw } from "lucide-react";
import { IconTile, Tag } from "@/components/orza/primitives";
import { cn, formatNumber } from "@/lib/utils";
import type { Meal } from "@/lib/types";
import { RichText } from "./RichText";
import { MEAL_TYPE_LABEL, clockTime, itemLabel, mealDateLabel } from "./format";
import type { UIMessage } from "./types";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fade/slide-in wrapper for messages that arrive live (history renders statically). */
function Appear({ animate, className, children }: { animate?: boolean; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (!animate || reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE }}>
      {children}
    </motion.div>
  );
}

export function UserBubble({ message, onRetry }: { message: UIMessage; onRetry?: (m: UIMessage) => void }) {
  const failed = message.status === "failed";
  return (
    <Appear animate={message.fresh} className="flex flex-col items-end">
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap break-words rounded-orza-md rounded-tr-[6px] bg-[#141414] px-4 py-3 text-[15px] leading-relaxed text-orza-bg-0 shadow-[0_10px_30px_rgba(20,20,20,0.14)] sm:max-w-[80%]",
          message.status === "sending" && "opacity-80",
          failed && "opacity-70"
        )}
      >
        {message.content}
      </div>
      {failed ? (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[#B02C2C]" role="status">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Not sent
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-orza-strong hover:bg-white/70"
            >
              <RotateCcw className="h-3 w-3" aria-hidden /> Retry
            </button>
          )}
        </div>
      ) : (
        message.status !== "sending" && (
          <time dateTime={message.created_at} className="mt-1 pr-1 font-mono text-[10px] tracking-[0.08em] text-orza-subtle">
            {clockTime(message.created_at)}
          </time>
        )
      )}
    </Appear>
  );
}

export function AssistantBubble({ message }: { message: UIMessage }) {
  const remembered = message.meta?.remembered || [];
  return (
    <Appear animate={message.fresh} className="flex flex-col items-start">
      <div className="max-w-[94%] rounded-orza-md rounded-tl-[6px] border border-[rgba(20,20,20,0.10)] bg-white/85 px-4 py-3 text-[15px] leading-relaxed text-orza-strong shadow-orza-glass backdrop-blur-orza sm:max-w-[85%]">
        <div className="mb-1.5 flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0B8FA6]">ÖRZA</span>
          <time dateTime={message.created_at} className="font-mono text-[10px] tracking-[0.08em] text-orza-subtle">
            {clockTime(message.created_at)}
          </time>
        </div>
        <RichText text={message.content} className="text-orza" />
      </div>
      {message.loggedMeal && <LoggedMealCard meal={message.loggedMeal} />}
      {remembered.length > 0 && (
        <div className="mt-2 flex max-w-[94%] flex-wrap items-center gap-1.5 text-xs text-orza-muted sm:max-w-[85%]">
          <BookmarkCheck className="h-3.5 w-3.5 text-[#6E3ED6]" aria-hidden />
          <span>Remembered</span>
          {remembered.map((f) => (
            <Tag key={f} tone="violet" size="sm" dot={false}>
              {f}
            </Tag>
          ))}
          <Link href="/dashboard/settings" className="ml-0.5 text-orza-subtle underline-offset-2 hover:text-orza-strong hover:underline">
            Manage
          </Link>
        </div>
      )}
      {message.notice && (
        <p className="mt-1.5 flex max-w-[94%] items-start gap-1.5 text-xs text-orza-subtle sm:max-w-[85%]">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {message.notice}
        </p>
      )}
    </Appear>
  );
}

/** Inline confirmation under a reply that logged a meal. */
export function LoggedMealCard({ meal }: { meal: Meal }) {
  const summary = meal.items.length ? meal.items.map(itemLabel).join(", ") : meal.description;
  const day = mealDateLabel(meal.date);
  return (
    <div className="mt-2 flex w-full max-w-[94%] items-start gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70 p-3 shadow-orza-glass backdrop-blur-orza sm:max-w-[85%] sm:p-3.5">
      <IconTile tone="energy" className="h-9 w-9">
        <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#C2410C]">
          Logged · {MEAL_TYPE_LABEL[meal.meal_type] || "Meal"}
          {day !== "Today" && ` · ${day}`}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-orza-strong">
          <span className="sr-only">Logged: </span>
          {summary}
        </p>
        <p className="mt-1 text-xs tabular-nums text-orza-muted">
          P {formatNumber(meal.totals.protein_g)} g · C {formatNumber(meal.totals.carbs_g)} g · F {formatNumber(meal.totals.fat_g)} g
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <div className="whitespace-nowrap font-editorial text-[20px] font-semibold leading-none text-orza-strong tabular-nums">
          {formatNumber(meal.totals.calories)}
          <span className="ml-1 font-sans text-xs font-normal text-orza-subtle">kcal</span>
        </div>
        <Link
          href={`/dashboard/meals?date=${meal.date}`}
          className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-[#0B8FA6] underline-offset-2 hover:underline"
        >
          Meal log <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function TypingIndicator() {
  const reduce = useReducedMotion();
  return (
    <div className="flex items-start" role="status" aria-label="ÖRZA is typing">
      <div className="rounded-orza-md rounded-tl-[6px] border border-[rgba(20,20,20,0.10)] bg-white/85 px-4 py-3 shadow-orza-glass backdrop-blur-orza">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#0B8FA6]">ÖRZA</span>
        <span className="flex h-4 items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) =>
            reduce ? (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-orza-subtle" />
            ) : (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-orza-energy"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: "easeInOut" }}
              />
            )
          )}
        </span>
      </div>
    </div>
  );
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-[rgba(20,20,20,0.08)]" />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{label}</span>
      <span className="h-px flex-1 bg-[rgba(20,20,20,0.08)]" />
    </div>
  );
}
