"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/orza/primitives";

export type ScanPhase = "idle" | "ready" | "scanning" | "result" | "logged";

const STEPS = [
  "Spotting each item on the plate",
  "Estimating portions — katoris, rotis, plates",
  "Reading the cooking style and oil",
  "Adding up calories and macros",
];

/** Four L-shaped corner brackets framing the shot (turn cyan while scanning). */
function Brackets({ active }: { active: boolean }) {
  const base = cn(
    "absolute h-7 w-7 border-[2.5px] transition-colors duration-500 ease-orza sm:h-9 sm:w-9",
    active ? "border-[#2FD2F0] drop-shadow-[0_0_8px_rgba(47,210,240,0.65)]" : "border-white/90 drop-shadow-[0_1px_4px_rgba(7,9,12,0.35)]"
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-3 sm:inset-4">
      <span className={cn(base, "left-0 top-0 rounded-tl-[12px] border-b-0 border-r-0")} />
      <span className={cn(base, "right-0 top-0 rounded-tr-[12px] border-b-0 border-l-0")} />
      <span className={cn(base, "bottom-0 left-0 rounded-bl-[12px] border-r-0 border-t-0")} />
      <span className={cn(base, "bottom-0 right-0 rounded-br-[12px] border-l-0 border-t-0")} />
    </div>
  );
}

/** Stylised thali shown before a photo is chosen (echoes the ÖRZA Lens illustration). */
function PlateIllustration() {
  return (
    <svg viewBox="0 0 800 600" className="absolute inset-0 h-full w-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="vf-plate" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#F7F4EF" />
          <stop offset="72%" stopColor="#E7DDD1" />
          <stop offset="100%" stopColor="#CDB894" />
        </radialGradient>
        <radialGradient id="vf-dal" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#F2B84B" />
          <stop offset="100%" stopColor="#C77F1A" />
        </radialGradient>
        <radialGradient id="vf-sabzi" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#9DBA5A" />
          <stop offset="100%" stopColor="#5E7E2A" />
        </radialGradient>
        <radialGradient id="vf-curd" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E9E4DA" />
        </radialGradient>
        <radialGradient id="vf-roti" cx="45%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#EFCB8A" />
          <stop offset="70%" stopColor="#D9A558" />
          <stop offset="100%" stopColor="#A8742C" />
        </radialGradient>
      </defs>
      <rect width="800" height="600" fill="#EFE7DD" />
      <ellipse cx="400" cy="540" rx="270" ry="20" fill="rgba(20,20,20,0.10)" />
      <circle cx="400" cy="300" r="236" fill="url(#vf-plate)" stroke="rgba(20,20,20,0.10)" strokeWidth="2" />
      <circle cx="400" cy="300" r="200" fill="none" stroke="rgba(20,20,20,0.06)" />
      {/* katoris */}
      {[
        { cx: 300, cy: 200, fill: "url(#vf-dal)" },
        { cx: 420, cy: 168, fill: "url(#vf-sabzi)" },
        { cx: 530, cy: 220, fill: "url(#vf-curd)" },
      ].map((k) => (
        <g key={k.cx}>
          <circle cx={k.cx} cy={k.cy} r="62" fill="#D8CCBB" stroke="rgba(20,20,20,0.12)" strokeWidth="2" />
          <circle cx={k.cx} cy={k.cy} r="50" fill={k.fill} />
          <ellipse cx={k.cx - 14} cy={k.cy - 16} rx="16" ry="8" fill="rgba(255,255,255,0.22)" />
        </g>
      ))}
      {/* rice */}
      <ellipse cx="330" cy="365" rx="96" ry="66" fill="#FBF8F1" stroke="rgba(20,20,20,0.06)" />
      <ellipse cx="312" cy="350" rx="40" ry="18" fill="rgba(255,255,255,0.8)" />
      {/* rotis */}
      <ellipse cx="505" cy="360" rx="92" ry="70" fill="url(#vf-roti)" />
      <ellipse cx="520" cy="385" rx="92" ry="70" fill="url(#vf-roti)" opacity="0.92" />
      <circle cx="498" cy="370" r="6" fill="rgba(122,70,20,0.45)" />
      <circle cx="545" cy="400" r="5" fill="rgba(122,70,20,0.4)" />
      <circle cx="530" cy="355" r="4" fill="rgba(122,70,20,0.35)" />
      {/* salad */}
      <circle cx="420" cy="455" r="10" fill="#E24B3B" />
      <circle cx="444" cy="462" r="9" fill="#9CC75A" />
      <circle cx="398" cy="468" r="8" fill="#F1E9C8" />
    </svg>
  );
}

/**
 * Glass viewfinder card (after the ÖRZA Lens scanner): corner brackets, the chosen photo,
 * a cyan scan line + progress steps while analysing, and a confidence chip on results.
 */
export function ScanViewfinder({
  image,
  phase,
  confidence,
  dishName,
  children,
}: {
  image: string | null;
  phase: ScanPhase;
  confidence?: number;
  dishName?: string;
  /** Controls rendered under the frame (take photo / upload / analyse). */
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const scanning = phase === "scanning";
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (!scanning) {
      setStep(0);
      return;
    }
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
    return () => clearInterval(t);
  }, [scanning]);

  const showResult = (phase === "result" || phase === "logged") && confidence != null;

  return (
    <GlassCard variant="strong" padded={false} className="p-3 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", scanning ? "animate-orza-pulse bg-[#2FD2F0]" : image ? "bg-[#127A56]" : "bg-orza-dot")} aria-hidden />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
            {scanning ? "Analysing" : phase === "logged" ? "Logged" : phase === "result" ? "Analysed" : image ? "Photo ready" : "Viewfinder"}
          </span>
        </div>
        <span className="text-[11px] text-orza-subtle">{image ? "Resized on your device" : "One plate at a time"}</span>
      </div>

      <div className="relative w-full overflow-hidden rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-[#EFE7DD]" style={{ aspectRatio: "4 / 3" }}>
        {image ? (
          <img src={image} alt="Your meal photo" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <PlateIllustration />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,247,241,0)_35%,rgba(239,231,221,0.55)_100%)]" aria-hidden />
            <div className="absolute inset-x-0 bottom-5 flex justify-center px-4 sm:bottom-7">
              <span className="rounded-full border border-[rgba(20,20,20,0.08)] bg-white/85 px-3.5 py-1.5 text-center text-[12px] font-medium text-orza-strong shadow-orza-glass backdrop-blur-orza">
                Frame the whole plate, from slightly above
              </span>
            </div>
          </>
        )}

        {/* Scanning overlay */}
        <AnimatePresence>
          {scanning && (
            <motion.div
              key="scan"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(7,9,12,0.22) 0%, rgba(7,9,12,0.42) 100%)" }} />
              {!reduce && (
                <motion.div
                  className="absolute inset-x-0 h-[2px]"
                  style={{
                    background: "linear-gradient(90deg, rgba(47,210,240,0), rgba(47,210,240,0.9), rgba(47,210,240,0))",
                    boxShadow: "0 0 14px rgba(47,210,240,0.65)",
                  }}
                  initial={{ top: "5%" }}
                  animate={{ top: ["5%", "95%", "5%"] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              <div className="absolute inset-x-0 bottom-4 flex justify-center px-4 sm:bottom-6">
                <span
                  role="status"
                  aria-live="polite"
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] font-medium text-orza-strong shadow-orza-floating"
                >
                  <Loader2 size={13} className="shrink-0 animate-spin text-[#0B8FA6]" aria-hidden />
                  <span className="truncate">{STEPS[step]}…</span>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result chips */}
        {showResult && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[rgba(7,9,12,0.55)] to-transparent" aria-hidden />
            <motion.div
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-orza-strong shadow-orza-floating sm:right-5 sm:top-5"
            >
              <span className="h-2 w-2 rounded-full bg-[#0BBEDC]" aria-hidden />
              Confidence · {Math.round((confidence ?? 0) * 100)}%
            </motion.div>
            {dishName && (
              <div className="absolute bottom-3 left-3 right-3 sm:bottom-5 sm:left-5">
                <span className="line-clamp-2 font-editorial text-[18px] font-semibold leading-snug text-white drop-shadow-[0_2px_8px_rgba(7,9,12,0.5)] sm:text-[22px]">
                  {dishName}
                </span>
              </div>
            )}
          </>
        )}

        <Brackets active={scanning} />
      </div>

      {children && <div className="mt-4">{children}</div>}
    </GlassCard>
  );
}
