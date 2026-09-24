import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dark ÖRZA hero surface with the glowing amber → coral → pink orb and film grain,
 * used for the live goal preview and "ÖRZA says" cards.
 */
export function OrbPanel({
  children,
  className,
  orb = "top-right",
  as: Comp = "div",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  orb?: "top-right" | "bottom-right" | "top-left";
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Comp
      className={cn(
        "relative isolate overflow-hidden rounded-orza-lg border border-white/10 bg-orza-hero text-[var(--orza-hero-text)] shadow-orza-floating",
        className
      )}
      {...rest}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -z-10 h-[300px] w-[300px] rounded-full animate-orza-pulse sm:h-[360px] sm:w-[360px]",
          {
            "top-right": "-right-28 -top-32",
            "bottom-right": "-bottom-36 -right-24",
            "top-left": "-left-28 -top-32",
          }[orb]
        )}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,231,200,0.9) 0%, rgba(255,180,84,0.72) 16%, rgba(255,122,106,0.36) 38%, rgba(255,95,162,0.12) 58%, rgba(7,9,12,0) 70%)",
          filter: "blur(10px)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 orza-hero-grain opacity-[0.05]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2"
        style={{ background: "linear-gradient(180deg, rgba(7,9,12,0) 0%, rgba(11,15,20,0.6) 100%)" }}
      />
      {children}
    </Comp>
  );
}
