import * as React from "react";
import { IconTile } from "@/components/orza/primitives";
import { cn } from "@/lib/utils";

/** Header row shared by the tracker cards: icon tile + mono label (+ optional right slot). */
export function TrackerHead({
  icon,
  tone,
  label,
  right,
}: {
  icon: React.ReactNode;
  tone: "cyan" | "energy" | "violet" | "neutral";
  label: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <IconTile tone={tone} className="h-9 w-9">
          {icon}
        </IconTile>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-muted">{label}</span>
      </div>
      {right && <div className="text-right text-xs text-orza-muted">{right}</div>}
    </div>
  );
}

/** Large editorial numeral with a quiet unit/caption, used across the Today cards. */
export function BigNumber({ value, caption, className }: { value: React.ReactNode; caption?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span className="font-editorial text-[34px] font-semibold leading-none tracking-[-0.02em] text-orza-strong tabular-nums">{value}</span>
      {caption && <span className="text-sm text-orza-muted">{caption}</span>}
    </div>
  );
}
