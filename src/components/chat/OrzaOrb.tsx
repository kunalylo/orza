import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ÖRZA's avatar: a dark sphere holding the glowing amber → coral → pink orb from the hero.
 * `size` in px; `glow` adds the soft halo used on the empty state.
 */
export function OrzaOrb({ size = 36, glow = false, pulse = false, className }: { size?: number; glow?: boolean; pulse?: boolean; className?: string }) {
  const core = Math.max(8, Math.round(size * 0.34));
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      {glow && (
        <span
          className={cn("absolute rounded-full blur-2xl", pulse && "animate-orza-pulse")}
          style={{
            inset: -size * 0.45,
            background: "radial-gradient(circle, rgba(255,180,84,0.45) 0%, rgba(255,122,106,0.26) 40%, rgba(255,95,162,0.12) 62%, rgba(251,247,241,0) 76%)",
          }}
        />
      )}
      <span
        className="relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#0B0F14] shadow-[0_8px_22px_rgba(255,122,106,0.28)]"
        style={{ boxShadow: glow ? "0 18px 50px rgba(255,122,106,0.30), 0 1px 0 rgba(255,255,255,0.12) inset" : undefined }}
      >
        <span
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 58%, rgba(255,180,84,0.55) 0%, rgba(255,122,106,0.34) 32%, rgba(255,95,162,0.16) 55%, rgba(11,15,20,0) 74%)",
          }}
        />
        <span
          className={cn("relative rounded-full bg-orza-dot", pulse && "animate-orza-pulse")}
          style={{ width: core, height: core, boxShadow: `0 0 ${Math.round(size * 0.35)}px rgba(255,180,84,0.85)` }}
        />
      </span>
    </span>
  );
}
