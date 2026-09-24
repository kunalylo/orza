"use client";
/** Small building blocks shared by the Credits, Settings and Admin screens. */
import * as React from "react";
import { CircleAlert, RotateCw } from "lucide-react";
import { Eyebrow, GlassCard, IconTile } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A settings-style glass section: icon tile + eyebrow + editorial title + description, then content. */
export function SectionCard({
  id,
  icon,
  tone = "neutral",
  eyebrow,
  title,
  description,
  actions,
  className,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  tone?: "neutral" | "cyan" | "energy" | "violet";
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <GlassCard as="section" id={id} aria-labelledby={`${id}-title`} variant="strong" className={cn("scroll-mt-32 lg:scroll-mt-10", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconTile tone={tone} className="mt-0.5">
            {icon}
          </IconTile>
          <div className="min-w-0">
            {eyebrow && <Eyebrow className="text-[11px]">{eyebrow}</Eyebrow>}
            <h2 id={`${id}-title`} className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
              {title}
            </h2>
            {description && <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-orza-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{actions}</div>}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </GlassCard>
  );
}

/** Accessible on/off switch (button role="switch"), warm energy track when on. */
export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  className,
  ...aria
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-220 ease-orza",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-transparent bg-orza-energy shadow-[0_6px_18px_rgba(255,122,106,0.30)]"
          : "border-[rgba(20,20,20,0.14)] bg-[rgba(20,20,20,0.08)]",
        className
      )}
      {...aria}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(20,20,20,0.18)] transition-transform duration-220 ease-orza-out",
          checked ? "translate-x-[22px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

/** Friendly load-failure card with a retry button. */
export function LoadError({ title, message, onRetry, className }: { title: string; message: string; onRetry: () => void; className?: string }) {
  return (
    <GlassCard variant="strong" className={cn("flex flex-col items-center px-6 py-12 text-center", className)} role="alert">
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#FDECEC] text-[#B02C2C]">
        <CircleAlert size={20} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="font-editorial text-lg font-semibold text-orza-strong">{title}</div>
      <p className="mt-1.5 max-w-sm text-sm text-orza-muted">{message}</p>
      <Button variant="primary" className="mt-5" onClick={onRetry}>
        <RotateCw size={15} strokeWidth={1.75} aria-hidden /> Try again
      </Button>
    </GlassCard>
  );
}

/** Inline form error (announced to screen readers). */
export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-[#B02C2C]">
      {children}
    </p>
  );
}

/* ───────────────────────────── Formatting ───────────────────────────── */

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "Today", "Yesterday", "3 days ago", else a date. */
export function relativeDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;
