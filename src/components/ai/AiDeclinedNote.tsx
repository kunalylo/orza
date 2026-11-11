"use client";
import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiDeclined } from "./AiConsentProvider";
import { ALLOW_AI_LABEL, declinedLine, type AiFeature } from "./copy";

/**
 * After Not now in the AI consent dialog: why the feature waits and what still works, with "Allow AI features" (and
 * the feature's own way without AI, as `children`). Shown until any Allow; announced politely, and scrolled into view
 * when it appears (a recipe's "Another" sits far below the generator). When the button the member asked from is gone
 * (a problem panel's Try again), keyboard focus lands on "Allow AI features" rather than the page.
 */
export function AiDeclinedNote({ feature, className, children }: { feature: AiFeature; className?: string; children?: React.ReactNode }) {
  const { declined, allow } = useAiDeclined(feature);
  const ref = React.useRef<HTMLDivElement>(null);
  const allowRef = React.useRef<HTMLButtonElement>(null);
  const was = React.useRef(declined);
  React.useEffect(() => {
    const appeared = declined && !was.current;
    was.current = declined;
    if (!appeared) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    // After the dialog has handed focus back (AiConsentProvider), and only if nothing took it.
    const t = setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) allowRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => clearTimeout(t);
  }, [declined]);

  return (
    <div aria-live="polite">
      {declined && (
        <div ref={ref} className={cn("rounded-orza-md border border-[rgba(11,143,166,0.22)] bg-[#EAF6FF] p-3.5", className)}>
          <p className="flex items-start gap-2 text-[13px] leading-relaxed text-[#0B6F82]">
            <Sparkles size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            <span>{declinedLine(feature)}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button ref={allowRef} size="sm" variant="secondary" onClick={allow}>
              {ALLOW_AI_LABEL}
            </Button>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
