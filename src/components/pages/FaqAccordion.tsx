"use client";
import * as React from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type FaqItem = { q: string; a: string };

/**
 * Glass-card FAQ accordion (Radix: keyboard + ARIA). Answers stay mounted (forceMount) so they
 * are server-rendered for search engines; closed panels are `inert` and collapse with a
 * grid-rows transition on an inner wrapper (Radix disables transitions on the Content node itself).
 */
export function FaqAccordion({
  items,
  idPrefix,
  defaultOpen = [],
  className,
}: {
  items: FaqItem[];
  idPrefix: string;
  /** Indexes of items open on first render. */
  defaultOpen?: number[];
  className?: string;
}) {
  const [open, setOpen] = React.useState<string[]>(() => defaultOpen.map((i) => `${idPrefix}-${i}`));

  return (
    <Accordion.Root type="multiple" value={open} onValueChange={setOpen} className={cn("flex flex-col gap-3", className)}>
      {items.map((item, i) => {
        const value = `${idPrefix}-${i}`;
        const isOpen = open.includes(value);
        return (
          <Accordion.Item
            key={value}
            value={value}
            className={cn(
              "rounded-orza-md border backdrop-blur-orza transition-[background-color,box-shadow,border-color] duration-220 ease-orza",
              isOpen
                ? "border-[rgba(11,190,220,0.28)] bg-[rgba(255,255,255,0.82)] shadow-orza-glass-hover"
                : "border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.60)] shadow-orza-glass hover:bg-[rgba(255,255,255,0.74)]"
            )}
          >
            <Accordion.Header>
              <Accordion.Trigger className="group flex w-full items-start gap-3 rounded-orza-md px-4 py-4 text-left sm:gap-4 sm:px-6 sm:py-5">
                <span aria-hidden className="w-6 shrink-0 pt-[3px] font-mono text-[11px] tabular-nums tracking-[0.1em] text-orza-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-[15px] font-medium leading-snug text-orza-strong sm:text-base">{item.q}</span>
                <span
                  aria-hidden
                  className={cn(
                    "-mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-[transform,background-color,color,border-color] duration-320 ease-orza-out",
                    "border-[rgba(20,20,20,0.10)] bg-white/70 text-orza-muted group-hover:text-orza-strong",
                    "group-data-[state=open]:rotate-45 group-data-[state=open]:border-transparent group-data-[state=open]:bg-[#141414] group-data-[state=open]:text-white"
                  )}
                >
                  <Plus size={14} strokeWidth={1.75} />
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content forceMount inert={!isOpen}>
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-320 ease-orza-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <p className="pb-5 pl-[52px] pr-5 text-[15px] leading-relaxed text-orza-muted sm:pb-6 sm:pl-[64px] sm:pr-16">{item.a}</p>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
