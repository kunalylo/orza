import * as React from "react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";

/** Warm energy orb (amber → coral → pink) — the light-canvas echo of the home hero core. */
const ORB =
  "radial-gradient(circle at 50% 50%, rgba(255,231,200,0.60) 0%, rgba(255,180,84,0.34) 22%, rgba(255,122,106,0.18) 42%, rgba(255,95,162,0.10) 58%, rgba(251,247,241,0) 72%)";

/** Italic energy-gradient accent for a word inside a page title. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <em className="orza-energy-text pr-[0.08em] italic">{children}</em>;
}

/**
 * Top-of-page hero for marketing sub-pages: cream canvas, soft glowing orb, grain,
 * mono eyebrow pill, editorial H1 and lead. Pulls itself up under the nav spacer so
 * the glow bleeds to the top of the viewport instead of being clipped.
 */
export function PageHero({
  eyebrow,
  icon,
  title,
  lead,
  align = "left",
  children,
  className,
}: {
  eyebrow: React.ReactNode;
  icon?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  children?: React.ReactNode;
  className?: string;
}) {
  const center = align === "center";
  return (
    <section className={cn("relative -mt-20 overflow-hidden pt-20 sm:-mt-24 sm:pt-24", className)}>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute",
          center ? "left-1/2 top-[-300px] -translate-x-1/2" : "right-[-260px] top-[-240px] sm:right-[-160px]"
        )}
      >
        <div className="h-[560px] w-[560px] animate-orza-pulse rounded-full blur-2xl sm:h-[680px] sm:w-[680px]" style={{ background: ORB }} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-180px] top-[60px] h-[420px] w-[420px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(47,210,240,0.12) 0%, rgba(251,247,241,0) 70%)" }}
      />
      <div aria-hidden className="orza-canvas-grain pointer-events-none absolute inset-0 opacity-70" />

      <Container className={cn("relative pb-12 pt-8 sm:pt-12 md:pb-16", center && "text-center")}>
        <div className={cn("max-w-3xl", center && "mx-auto")}>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-muted backdrop-blur-orza">
              {icon}
              {eyebrow}
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-5 font-editorial text-[40px] font-semibold leading-[1.08] tracking-[-0.025em] text-orza-strong sm:text-[52px] lg:text-[62px]">
              {title}
            </h1>
          </Reveal>
          {lead && (
            <Reveal delay={0.12}>
              <p className={cn("mt-5 max-w-2xl text-base leading-relaxed text-orza-muted sm:text-lg", center && "mx-auto")}>{lead}</p>
            </Reveal>
          )}
          {children && (
            <Reveal delay={0.18} className="mt-8">
              {children}
            </Reveal>
          )}
        </div>
      </Container>
    </section>
  );
}
