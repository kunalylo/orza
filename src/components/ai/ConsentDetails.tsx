"use client";
import * as React from "react";
import { ArrowUpRight, Camera, ChefHat, FileText, Lock, MessageCircle, type LucideIcon } from "lucide-react";
import { IconTile } from "@/components/orza/primitives";
import { AI_PRIVACY_PATH, CONSENT_COPY, consentAfter, type ConsentContext, type ConsentPointIcon } from "./copy";

const ICONS: Record<ConsentPointIcon, LucideIcon> = { meals: Camera, chat: MessageCircle, recipes: ChefHat, rx: FileText, never: Lock };

/** A dialog title with a small eyebrow above it. The eyebrow is hidden from screen readers, so the title is the dialog's name. */
export function ConsentTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <span aria-hidden className="mb-1.5 block font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-orza-subtle">
        {eyebrow}
      </span>
      {title}
    </>
  );
}

/**
 * What ÖRZA sends to OpenAI (the five points), the lines under them and the privacy link — the consent dialog's body,
 * and Settings → Preferences → AI features. It scrolls on its own, so the buttons under it stay in view on a phone
 * (`relative`: the link's screen-reader text is absolutely positioned and must not stretch the dialog's own scroll).
 * It is a Tab stop, so the points can be scrolled with the keyboard (a browser that skips links on Tab has no other way in).
 */
export function ConsentDetails({ context }: { context: ConsentContext }) {
  return (
    <div
      role="region"
      aria-label="What ÖRZA sends to OpenAI"
      tabIndex={0}
      className="relative -mx-1 max-h-[calc(100dvh-400px)] min-h-[140px] overflow-y-auto rounded-sm px-1 sm:max-h-[calc(100dvh-360px)]"
    >
      <ul className="space-y-3">
        {CONSENT_COPY.points.map(({ icon, text }) => {
          const Icon = ICONS[icon];
          const [head, ...rest] = text.split(" — ");
          return (
            <li key={icon} className="flex items-start gap-3">
              <IconTile tone={icon === "never" ? "neutral" : "cyan"} className="h-8 w-8">
                <Icon size={15} strokeWidth={1.75} aria-hidden />
              </IconTile>
              <p className="min-w-0 pt-1 text-[13px] leading-relaxed text-orza-muted">
                {rest.length ? (
                  <>
                    <span className="font-medium text-orza-strong">{head}</span> — {rest.join(" — ")}
                  </>
                ) : (
                  text
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 space-y-1.5 border-t border-[rgba(20,20,20,0.08)] pt-4 text-[13px] leading-relaxed text-orza-muted">
        {consentAfter(context).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <a
        href={AI_PRIVACY_PATH}
        target="_blank"
        rel="noopener"
        className="mt-3 inline-flex items-center gap-1 rounded-sm text-[13px] font-medium text-orza-strong underline decoration-[rgba(20,20,20,0.25)] underline-offset-2 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/40"
      >
        {CONSENT_COPY.link}
        <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}
