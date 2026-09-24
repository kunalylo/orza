import * as React from "react";
import { cn } from "@/lib/utils";

/* ───────────────────────────── GlassCard ───────────────────────────── */

/** Primary ÖRZA surface. Variants: base | strong | subtle | hero (for dark backgrounds). */
export function GlassCard({
  as: Comp = "div",
  variant = "base",
  padded = true,
  hover = false,
  className,
  children,
  ...rest
}: {
  as?: React.ElementType;
  variant?: "base" | "strong" | "subtle" | "hero";
  padded?: boolean;
  hover?: boolean;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Comp
      className={cn(
        "rounded-orza-md border backdrop-blur-orza",
        "transition-[background-color,box-shadow,border-color,transform] duration-220 ease-orza",
        {
          base: "bg-[rgba(255,255,255,0.62)] border-[rgba(20,20,20,0.10)] shadow-orza-glass",
          strong: "bg-[rgba(255,255,255,0.80)] border-[rgba(20,20,20,0.10)] shadow-orza-glass",
          subtle: "bg-[rgba(255,255,255,0.46)] border-[rgba(20,20,20,0.10)]",
          hero: "bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.14)] text-[var(--orza-hero-text)]",
        }[variant],
        padded && "p-5 sm:p-6",
        hover && variant !== "hero" && "hover:bg-[rgba(255,255,255,0.74)] hover:shadow-orza-glass-hover",
        hover && variant === "hero" && "hover:bg-[rgba(255,255,255,0.12)]",
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/* ───────────────────────────── Section ───────────────────────────── */

/** Marketing section: consistent padding + 1200px container. tone: canvas (bg-0) | raised (bg-1) | deep (bg-2) | hero (dark). */
export function Section({
  id,
  tone = "canvas",
  fluid = false,
  className,
  containerClassName,
  children,
  ...rest
}: {
  id?: string;
  tone?: "canvas" | "raised" | "deep" | "hero";
  fluid?: boolean;
  className?: string;
  containerClassName?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full py-16 md:py-24 lg:py-28 scroll-mt-20",
        {
          canvas: "bg-orza-bg-0",
          raised: "bg-orza-bg-1",
          deep: "bg-orza-bg-2",
          hero: "bg-orza-hero text-[var(--orza-hero-text)]",
        }[tone],
        className
      )}
      {...rest}
    >
      {fluid ? children : <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", containerClassName)}>{children}</div>}
    </section>
  );
}

export function Container({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** Mono uppercase label above headings, e.g. "THE PROBLEM". */
export function Eyebrow({ children, className, tone = "light" }: { children: React.ReactNode; className?: string; tone?: "light" | "dark" }) {
  return (
    <div
      className={cn(
        "font-mono text-[12px] leading-[18px] tracking-[0.14em] uppercase",
        tone === "dark" ? "text-white/60" : "text-orza-muted",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Heading({
  children,
  className,
  tone = "light",
  as: Comp = "h2",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
  as?: React.ElementType;
} & Omit<React.HTMLAttributes<HTMLHeadingElement>, "children" | "className">) {
  return (
    <Comp
      {...rest}
      className={cn(
        "font-editorial font-semibold tracking-[-0.02em]",
        "text-[32px] leading-[40px] sm:text-[40px] sm:leading-[48px] lg:text-[44px] lg:leading-[52px]",
        tone === "dark" ? "text-white" : "text-orza-strong",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function Lead({ children, className, tone = "light" }: { children: React.ReactNode; className?: string; tone?: "light" | "dark" }) {
  return <p className={cn("text-base sm:text-lg leading-relaxed", tone === "dark" ? "text-white/70" : "text-orza-muted", className)}>{children}</p>;
}

/** Two-column section header used across the site: eyebrow + heading on the left, lead on the right. */
export function SectionHeader({
  eyebrow,
  title,
  lead,
  tone = "light",
  align = "split",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  tone?: "light" | "dark";
  align?: "split" | "left" | "center";
  className?: string;
}) {
  if (align === "split") {
    return (
      <div className={cn("grid gap-6 lg:grid-cols-2 lg:items-end", className)}>
        <div>
          {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
          <Heading tone={tone} className="mt-3">{title}</Heading>
        </div>
        {lead && <Lead tone={tone} className="lg:pb-1.5">{lead}</Lead>}
      </div>
    );
  }
  return (
    <div className={cn(align === "center" && "text-center mx-auto max-w-3xl", className)}>
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <Heading tone={tone} className="mt-3">{title}</Heading>
      {lead && <Lead tone={tone} className={cn("mt-4", align === "center" && "mx-auto max-w-2xl")}>{lead}</Lead>}
    </div>
  );
}

/* ───────────────────────────── Tags & chips ───────────────────────────── */

export type TagTone = "success" | "info" | "warning" | "violet" | "neutral" | "danger" | "energy";

export function Tag({ tone = "neutral", dot = true, size = "md", className, children }: { tone?: TagTone; dot?: boolean; size?: "sm" | "md"; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium tracking-[0.01em]",
        {
          success: "bg-[#EAF7F1] text-[#127A56] border-[rgba(18,122,86,0.22)]",
          info: "bg-[#EAF6FF] text-[#0B8FA6] border-[rgba(11,143,166,0.22)]",
          warning: "bg-[#FFF4E6] text-[#B06A00] border-[rgba(176,106,0,0.22)]",
          violet: "bg-[rgba(135,87,242,0.10)] text-[#5630A8] border-[rgba(135,87,242,0.22)]",
          neutral: "bg-white/70 text-orza-muted border-[rgba(20,20,20,0.10)]",
          danger: "bg-[#FDECEC] text-[#B02C2C] border-[rgba(176,44,44,0.22)]",
          energy: "bg-[#FFF1EA] text-[#C2410C] border-[rgba(255,122,106,0.30)]",
        }[tone],
        size === "sm" ? "px-2 py-[2px] text-[11px] leading-4" : "px-2.5 py-1 text-[12px] leading-4",
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />}
      {children}
    </span>
  );
}

/** Rounded icon tile used at the top of feature cards. */
export function IconTile({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "cyan" | "energy" | "violet" | "dark"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
        {
          neutral: "bg-white/80 border-[rgba(20,20,20,0.10)] text-orza-strong",
          cyan: "bg-[#E8FBFF] border-[rgba(11,190,220,0.25)] text-[#0B8FA6]",
          energy: "bg-[#FFF1EA] border-[rgba(255,122,106,0.28)] text-[#E0593F]",
          violet: "bg-[#F4F1FF] border-[rgba(135,87,242,0.22)] text-[#6E3ED6]",
          dark: "bg-white/10 border-white/20 text-white",
        }[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ───────────────────────────── Brand ───────────────────────────── */

export function BrandMark({ tone = "light", showPronunciation = true, className }: { tone?: "light" | "dark"; showPronunciation?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-220 ease-orza",
          tone === "dark" ? "bg-white/10 border-white/25" : "bg-white/70 border-[rgba(20,20,20,0.10)]"
        )}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-orza-dot" />
      </span>
      <span className="font-editorial text-[18px] font-semibold tracking-[-0.01em]">ÖRZA</span>
      {showPronunciation && <span className="hidden lg:inline ml-1 font-mono text-[11px] uppercase tracking-[0.14em] opacity-60">/Urja/</span>}
    </span>
  );
}

/* ───────────────────────────── Energy ring ───────────────────────────── */

/**
 * Circular progress ring with the ÖRZA energy gradient (amber → coral → pink),
 * like the Energy Index on the ecosystem site. `value`/`max` drive the arc.
 */
export function EnergyRing({
  value,
  max,
  size = 220,
  stroke = 12,
  children,
  className,
  id = "orza-ring",
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <div
        aria-hidden
        className="absolute inset-[12%] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(255,180,84,0.22) 0%, rgba(255,122,106,0.10) 45%, rgba(251,247,241,0) 72%)" }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFB454" />
            <stop offset="55%" stopColor="#FF7A6A" />
            <stop offset="100%" stopColor="#FF5FA2" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,20,20,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id}-grad)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Thin horizontal progress bar. */
export function Bar({ value, max, tone = "energy", className }: { value: number; max: number; tone?: "energy" | "cyan" | "violet" | "success"; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[rgba(20,20,20,0.07)]", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-orza-out", {
          energy: "bg-orza-energy",
          cyan: "bg-gradient-to-r from-[#63E2FA] to-[#0BBEDC]",
          violet: "bg-gradient-to-r from-[#BFA8FF] to-[#8757F2]",
          success: "bg-gradient-to-r from-[#5FD3A4] to-[#127A56]",
        }[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
