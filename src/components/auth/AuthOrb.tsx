"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/*
 * The ÖRZA energy orb (amber → coral → pink core on dashed cyan orbits), used on the
 * auth + onboarding screens. A calmer cousin of the home hero scene: no labels, a slow
 * orbit and a breathing core. `tone="light"` retunes the orbit lines for the cream canvas.
 */

const C = 300; // viewBox centre (600×600)
const r2 = (n: number) => Math.round(n * 100) / 100; // identical SSR/CSR attribute strings

const RINGS = [186, 228, 270];
const SATELLITES = [
  { r: 186, deg: -38, size: 5, color: "#BFA8FF" },
  { r: 228, deg: 112, size: 4, color: "#63E2FA" },
  { r: 270, deg: 206, size: 5.5, color: "#BFA8FF" },
  { r: 228, deg: 292, size: 3.5, color: "#FFB454" },
].map((s) => {
  const rad = (s.deg * Math.PI) / 180;
  return { ...s, x: r2(C + Math.cos(rad) * s.r), y: r2(C + Math.sin(rad) * s.r) };
});
const SPOKES = Array.from({ length: 12 }, (_, i) => {
  const rad = ((i * 30 - 90) * Math.PI) / 180;
  return { i, x1: r2(C + Math.cos(rad) * 150), y1: r2(C + Math.sin(rad) * 150), x2: r2(C + Math.cos(rad) * 262), y2: r2(C + Math.sin(rad) * 262) };
});

export function AuthOrb({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const reduce = useReducedMotion();
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  // Looping motion starts after hydration so server and client markup match.
  const [live, setLive] = React.useState(false);
  React.useEffect(() => setLive(true), []);
  const loop = live && !reduce;

  const ring = tone === "dark" ? "rgba(47,210,240,0.16)" : "rgba(11,143,166,0.20)";
  const spoke = tone === "dark" ? "rgba(47,210,240,0.12)" : "rgba(11,143,166,0.10)";
  const id = (name: string) => `${name}-${uid}`;

  return (
    <div className={cn("pointer-events-none relative aspect-square", className)} aria-hidden>
      <div
        className="absolute inset-[6%] rounded-full"
        style={{
          background:
            tone === "dark"
              ? "radial-gradient(circle, rgba(255,180,84,0.26) 0%, rgba(255,122,106,0.12) 32%, rgba(7,9,12,0) 64%)"
              : "radial-gradient(circle, rgba(255,180,84,0.30) 0%, rgba(255,122,106,0.12) 34%, rgba(251,247,241,0) 66%)",
          filter: "blur(22px)",
        }}
      />
      <svg viewBox="0 0 600 600" className="relative h-full w-full overflow-visible" focusable="false">
        <defs>
          <radialGradient id={id("core")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE7C8" stopOpacity="0.98" />
            <stop offset="35%" stopColor="#FFB454" stopOpacity="0.86" />
            <stop offset="70%" stopColor="#FF7A6A" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#FF5FA2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={id("inner")} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="60%" stopColor="#FFE7C8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FFB454" stopOpacity="0" />
          </radialGradient>
          <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Spokes: faint signal lines feeding the core */}
        {SPOKES.map((s) => (
          <line key={s.i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={spoke} strokeWidth="1" strokeDasharray="1 5" />
        ))}

        {/* Orbits + satellites, turning slowly */}
        <g className={cn(loop && "animate-orza-spin-slow")} style={{ transformOrigin: `${C}px ${C}px` }}>
          {RINGS.map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke={ring} strokeWidth="1" strokeDasharray="2 6" />
          ))}
          {SATELLITES.map((s, i) => (
            <g key={i}>
              <circle cx={s.x} cy={s.y} r={s.size} fill={s.color} opacity="0.9" filter={`url(#${id("glow")})`} />
              <circle cx={s.x} cy={s.y} r={s.size / 2.5} fill="#F7F4EF" opacity="0.95" />
            </g>
          ))}
        </g>

        {/* Breathing core */}
        <motion.g
          initial={false}
          animate={loop ? { scale: [1, 1.045, 1] } : { scale: 1 }}
          transition={loop ? { duration: 4.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
          style={{ transformOrigin: `${C}px ${C}px` }}
        >
          <circle cx={C} cy={C} r="140" fill={`url(#${id("core")})`} filter={`url(#${id("glow")})`} />
          <circle cx={C} cy={C} r="54" fill={`url(#${id("inner")})`} />
          <circle cx={C} cy={C} r="20" fill="#FFF7EA" opacity="0.92" />
        </motion.g>
      </svg>
    </div>
  );
}
