"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/*
 * ÖRZA convergence orb — ported from the ecosystem site's hero scene.
 * Twelve wellness signals sit on a dashed orbit, spokes draw into a warm pulsing core,
 * small pulses travel inward and five soft rays breathe outward. Pure SVG + framer-motion.
 */

const C = 400; // viewBox centre (viewBox is 800×800)
const NODE_R = 262;
const CORE_EDGE = 118;
const EASE = [0.16, 1, 0.3, 1] as const;

// Round so server and browser produce identical attribute strings.
const r2 = (n: number) => Math.round(n * 100) / 100;

const LABELS = ["MEALS", "CAMERA", "VOICE", "HINDI", "RECIPES", "GOALS", "STEPS", "WATER", "WEIGHT", "FAMILY", "MEMORY", "RECOVERY"];

type Anchor = "start" | "middle" | "end";

const NODES = LABELS.map((label, i) => {
  const rad = ((-90 + i * 30) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const labelR = NODE_R + 24 + Math.abs(sin) * 8;
  const anchor: Anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
  return {
    label,
    i,
    x: r2(C + cos * NODE_R),
    y: r2(C + sin * NODE_R),
    lx: r2(C + cos * labelR),
    ly: r2(C + sin * labelR),
    anchor,
    // travel vector for the inbound pulse: node → edge of the core
    dx: r2(cos * (CORE_EDGE - NODE_R)),
    dy: r2(sin * (CORE_EDGE - NODE_R)),
  };
});

// Output rays sit between spokes (offset 15°) so they never overlap a signal line.
const RAYS = [0, 1, 2, 3, 4].map((i) => {
  const rad = ((i * 72 - 75) * Math.PI) / 180;
  return { i, x2: r2(C + Math.cos(rad) * 372), y2: r2(C + Math.sin(rad) * 372) };
});

const SATELLITE_A = { x: C + 200, y: C };
const SATELLITE_B = { x: r2(C + Math.cos(Math.PI / 4) * 330), y: r2(C + Math.sin(Math.PI / 4) * 330) };

export function HeroScene({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  // Looping effects mount after hydration so server and client markup always match.
  const [live, setLive] = React.useState(false);
  React.useEffect(() => setLive(true), []);
  const loop = live && !reduce;

  return (
    <div className={cn("relative aspect-square w-full", className)} aria-hidden>
      {/* Ambient warm halo behind the core */}
      <div
        className="pointer-events-none absolute inset-[4%] rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(255,180,84,0.22) 0%, rgba(255,122,106,0.09) 32%, rgba(7,9,12,0) 62%)",
          filter: "blur(20px)",
        }}
      />

      <svg viewBox="0 0 800 800" className="relative h-full w-full overflow-visible" focusable="false">
        <defs>
          <radialGradient id="orza-hero-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE7C8" stopOpacity="0.98" />
            <stop offset="35%" stopColor="#FFB454" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#FF7A6A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF5FA2" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orza-hero-core-inner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="60%" stopColor="#FFE7C8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FFB454" stopOpacity="0" />
          </radialGradient>
          {RAYS.map((r) => (
            <linearGradient key={r.i} id={`orza-hero-ray-${r.i}`} gradientUnits="userSpaceOnUse" x1={C} y1={C} x2={r.x2} y2={r.y2}>
              <stop offset="0%" stopColor="#2FD2F0" stopOpacity="0" />
              <stop offset="35%" stopColor="#2FD2F0" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#BFA8FF" stopOpacity="0" />
            </linearGradient>
          ))}
          <filter id="orza-hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Faint outer boundary */}
        <circle cx={C} cy={C} r={372} fill="none" stroke="rgba(247,244,239,0.05)" strokeWidth={1} />

        {/* Slowly rotating dashed orbits, each carrying a small satellite */}
        <g className="animate-orza-spin-slow" style={{ transformBox: "view-box", transformOrigin: "50% 50%" }}>
          <circle cx={C} cy={C} r={200} fill="none" stroke="rgba(47,210,240,0.10)" strokeWidth={1} strokeDasharray="2 6" />
          <circle cx={SATELLITE_A.x} cy={SATELLITE_A.y} r={3} fill="#63E2FA" opacity={0.85} filter="url(#orza-hero-glow)" />
        </g>
        <g
          className="animate-orza-spin-slow"
          style={{ transformBox: "view-box", transformOrigin: "50% 50%", animationDirection: "reverse", animationDuration: "90s" }}
        >
          <circle cx={C} cy={C} r={330} fill="none" stroke="rgba(47,210,240,0.08)" strokeWidth={1} strokeDasharray="2 8" />
          <circle cx={SATELLITE_B.x} cy={SATELLITE_B.y} r={2.5} fill="#BFA8FF" opacity={0.8} filter="url(#orza-hero-glow)" />
        </g>
        {/* The orbit the signal nodes sit on */}
        <circle cx={C} cy={C} r={NODE_R} fill="none" stroke="rgba(47,210,240,0.14)" strokeWidth={1} strokeDasharray="2 6" />

        {/* Spokes: each signal draws a line into the core */}
        {NODES.map((n) => (
          <motion.line
            key={`spoke-${n.i}`}
            x1={n.x}
            y1={n.y}
            x2={C}
            y2={C}
            stroke="rgba(47,210,240,0.9)"
            strokeWidth={1}
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.26 }}
            transition={{ delay: 0.45 + n.i * 0.05, duration: 1.4, ease: EASE }}
          />
        ))}

        {/* Output rays */}
        {RAYS.map((r) => (
          <motion.line
            key={`ray-${r.i}`}
            x1={C}
            y1={C}
            x2={r.x2}
            y2={r.y2}
            stroke={`url(#orza-hero-ray-${r.i})`}
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={loop ? { opacity: [0, 0.75, 0.3] } : { opacity: reduce ? 0.45 : 0 }}
            transition={
              loop
                ? { delay: 1.8 + r.i * 0.2, duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }
                : { duration: 0 }
            }
          />
        ))}

        {/* Warm core: entrance, then a slow breathing pulse */}
        <motion.g
          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <motion.g
            animate={loop ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={loop ? { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.2 } : { duration: 0 }}
          >
            <circle cx={C} cy={C} r={150} fill="url(#orza-hero-core)" filter="url(#orza-hero-glow)" />
            <circle cx={C} cy={C} r={54} fill="url(#orza-hero-core-inner)" />
            <circle cx={C} cy={C} r={20} fill="#FFF7EA" opacity={0.92} />
          </motion.g>
        </motion.g>

        {/* Inbound pulses travelling along the spokes */}
        {loop &&
          NODES.map((n) => (
            <motion.circle
              key={`pulse-${n.i}`}
              cx={n.x}
              cy={n.y}
              r={3.2}
              fill="#FFE7C8"
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ x: [0, n.dx], y: [0, n.dy], opacity: [0, 1, 0] }}
              transition={{
                duration: 2.6,
                ease: "easeIn",
                repeat: Infinity,
                repeatDelay: 2.4 + (n.i % 3) * 0.8,
                delay: 1.8 + n.i * 0.28,
              }}
            />
          ))}

        {/* Signal nodes */}
        {NODES.map((n) => (
          <motion.g
            key={`node-${n.i}`}
            initial={reduce ? false : { opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + n.i * 0.05, duration: 0.7, ease: EASE }}
          >
            <circle cx={n.x} cy={n.y} r={11} fill="rgba(191,168,255,0.08)" stroke="rgba(191,168,255,0.28)" strokeWidth={1} />
            <circle cx={n.x} cy={n.y} r={5} fill="#BFA8FF" opacity={0.95} filter="url(#orza-hero-glow)" />
            <circle cx={n.x} cy={n.y} r={2} fill="#F7F4EF" />
          </motion.g>
        ))}

        {/* Labels — font size is in viewBox units, so it grows as the orb shrinks on phones */}
        {NODES.map((n) => (
          <motion.text
            key={`label-${n.i}`}
            x={n.lx}
            y={n.ly}
            textAnchor={n.anchor}
            dominantBaseline="middle"
            fill="rgba(247,244,239,0.6)"
            className="font-mono text-[22px] sm:text-[17px] lg:text-[15px]"
            style={{ letterSpacing: "0.12em" }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 + n.i * 0.05, duration: 0.8 }}
          >
            {n.label}
          </motion.text>
        ))}
      </svg>
    </div>
  );
}
