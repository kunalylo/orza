"use client";
import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SpyItem = { id: string; label: string; count?: number };

/**
 * In-page navigation that highlights the section currently being read.
 * - `chips`: horizontal scrolling pills on mobile, vertical list on lg (FAQ categories).
 * - `toc`: numbered vertical table of contents with a cyan rail (legal pages).
 * A section counts as active once its top passes `offset` px from the viewport top.
 */
export function ScrollSpyNav({
  items,
  label,
  variant = "chips",
  offset = 160,
  className,
}: {
  items: SpyItem[];
  label: string;
  variant?: "chips" | "toc";
  offset?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [active, setActive] = React.useState(items[0]?.id);
  const listRef = React.useRef<HTMLUListElement>(null);
  const ids = items.map((i) => i.id).join("|");

  React.useEffect(() => {
    const list = ids.split("|").filter(Boolean);
    let raf = 0;
    const update = () => {
      raf = 0;
      let current = list[0];
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) current = id;
        else break;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) current = list[list.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids, offset]);

  // Keep the active chip visible inside the horizontal scroller (mobile).
  React.useEffect(() => {
    const ul = listRef.current;
    if (variant !== "chips" || !ul || ul.scrollWidth <= ul.clientWidth || !active) return;
    const el = ul.querySelector<HTMLElement>(`[data-spy="${active}"]`);
    if (!el) return;
    ul.scrollTo({ left: el.offsetLeft - (ul.clientWidth - el.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active, variant, reduce]);

  if (variant === "toc") {
    return (
      <nav aria-label={label} className={className}>
        <ul className="border-l border-[rgba(20,20,20,0.10)]">
          {items.map((it, i) => {
            const on = it.id === active;
            return (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  aria-current={on ? "location" : undefined}
                  className={cn(
                    "-ml-px flex gap-3 border-l-2 py-1.5 pl-4 pr-2 text-[13px] leading-snug transition-colors duration-150 ease-orza",
                    on
                      ? "border-orza-cyan font-medium text-orza-strong"
                      : "border-transparent text-orza-muted hover:border-[rgba(20,20,20,0.25)] hover:text-orza-strong"
                  )}
                >
                  <span aria-hidden className="w-5 shrink-0 pt-px font-mono text-[11px] tabular-nums text-orza-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{it.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label={label} className={className}>
      <ul ref={listRef} className="no-scrollbar relative flex gap-2 overflow-x-auto lg:flex-col lg:gap-1 lg:overflow-visible">
        {items.map((it) => {
          const on = it.id === active;
          return (
            <li key={it.id} className="shrink-0">
              <a
                href={`#${it.id}`}
                data-spy={it.id}
                aria-current={on ? "location" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13px] transition-[background-color,color,border-color,box-shadow] duration-150 ease-orza",
                  "lg:flex lg:h-auto lg:w-full lg:rounded-orza-sm lg:px-3 lg:py-2.5 lg:text-sm",
                  on
                    ? "border-[rgba(11,190,220,0.35)] bg-white font-medium text-orza-strong shadow-orza-glass lg:bg-white/80"
                    : "border-[rgba(20,20,20,0.10)] bg-white/55 text-orza-muted hover:bg-white/85 hover:text-orza-strong lg:border-transparent lg:bg-transparent lg:hover:bg-white/60"
                )}
              >
                <span
                  aria-hidden
                  className={cn("hidden h-1.5 w-1.5 shrink-0 rounded-full lg:block", on ? "bg-orza-cyan" : "bg-[rgba(20,20,20,0.18)]")}
                />
                <span className="lg:flex-1">{it.label}</span>
                {it.count != null && (
                  <span aria-hidden className="font-mono text-[11px] tabular-nums text-orza-subtle">
                    {it.count}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
