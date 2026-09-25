"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

type Phase = "enter" | "waiting" | "shown";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/**
 * Fade/slide-in (once). Wrap any block; stagger with `delay` (seconds).
 *
 * Content is never hidden in the server HTML: it renders with a CSS-only entrance
 * (`.orza-reveal-enter` in globals.css) that finishes visible even without JavaScript, so hero
 * headings don't wait for hydration to appear. After hydration, blocks that start below the fold
 * are hidden (before the browser paints) and fade in as they scroll into view. Honours
 * prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [phase, setPhase] = React.useState<Phase>("enter");

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    // Already on screen: its CSS entrance is playing (or done) — leave it alone.
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    setPhase("waiting");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      className={cn(className, phase === "enter" ? "orza-reveal-enter" : "orza-reveal", phase === "waiting" && "is-waiting")}
      style={{ "--orza-reveal-y": `${y}px`, "--orza-reveal-delay": `${delay}s` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
