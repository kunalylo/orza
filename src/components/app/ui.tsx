import * as React from "react";
import { cn, formatNumber } from "@/lib/utils";
import { Bar, Eyebrow } from "@/components/orza/primitives";

/** Top-of-page header for app screens. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-2 font-editorial text-[30px] font-semibold leading-[38px] tracking-[-0.02em] text-orza-strong sm:text-[36px] sm:leading-[44px]">
          {title}
        </h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-orza-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Compact metric tile. */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  className,
  children,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.62)] p-5 shadow-orza-glass backdrop-blur-orza", className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{label}</span>
        {icon && <span className="text-orza-muted">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-editorial text-[30px] font-semibold leading-none text-orza-strong">{value}</span>
        {unit && <span className="text-sm text-orza-subtle">{unit}</span>}
      </div>
      {hint && <div className="mt-2 text-xs text-orza-muted">{hint}</div>}
      {children}
    </div>
  );
}

/** Macro row: label, consumed/target, bar. */
export function MacroRow({ label, value, target, unit = "g", tone = "energy" }: { label: string; value: number; target: number; unit?: string; tone?: "energy" | "cyan" | "violet" | "success" }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[13px]">
        <span className="text-orza-strong">{label}</span>
        <span className="tabular-nums text-orza-muted">
          {formatNumber(value)} / {formatNumber(target)} {unit}
        </span>
      </div>
      <Bar value={value} max={target} tone={tone} />
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-orza-md border border-dashed border-[rgba(20,20,20,0.14)] bg-white/40 px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-orza-muted shadow-orza-glass">{icon}</div>}
      <div className="font-editorial text-lg font-semibold text-orza-strong">{title}</div>
      {description && <p className="mt-1.5 max-w-sm text-sm text-orza-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Small note shown near AI output. */
export function WellnessNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-orza-subtle", className)}>
      Wellness guidance, not medical advice. For medical concerns, please consult your doctor.
    </p>
  );
}
