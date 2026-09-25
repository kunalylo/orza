"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Finding each medicine on the page",
  "Reading brand and generic names",
  "Decoding 1-0-1, BD, TDS and SOS",
  "Working out food timing and course length",
  "Setting alarm times",
];

/** Stylised prescription pad shown before a photo is chosen. */
function PadIllustration() {
  return (
    <svg viewBox="0 0 600 450" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="600" height="450" fill="#EFE7DD" />
      <g transform="rotate(-3 300 225)">
        <rect x="150" y="36" width="300" height="390" rx="10" fill="#FFFDF8" stroke="rgba(20,20,20,0.10)" strokeWidth="2" />
        <rect x="150" y="36" width="300" height="56" rx="10" fill="#F4EDE3" />
        <rect x="172" y="52" width="120" height="10" rx="5" fill="rgba(20,20,20,0.28)" />
        <rect x="172" y="70" width="84" height="7" rx="3.5" fill="rgba(20,20,20,0.14)" />
        <text x="172" y="136" fontFamily="Georgia, serif" fontSize="30" fontStyle="italic" fill="rgba(20,20,20,0.55)">
          Rx
        </text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(0 ${i * 58})`}>
            <path d={`M178 ${168} q18 -10 36 0 t36 0 t36 0`} fill="none" stroke="rgba(30,40,90,0.55)" strokeWidth="3" strokeLinecap="round" />
            <path d={`M296 ${168} q10 -8 20 0 t20 0`} fill="none" stroke="rgba(30,40,90,0.45)" strokeWidth="3" strokeLinecap="round" />
            <text x="352" y={174} fontFamily="ui-monospace, monospace" fontSize="17" fill="rgba(30,40,90,0.6)">
              {["1-0-1", "0-0-1", "BD", "SOS"][i]}
            </text>
            <path d={`M190 ${188} q14 -6 28 0 t28 0`} fill="none" stroke="rgba(30,40,90,0.3)" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}

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

/** Frame for the prescription photo, with a cyan scan line and progress steps while ÖRZA reads it. */
export function RxViewfinder({ image, scanning, className }: { image: string | null; scanning: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (!scanning) {
      setStep(0);
      return;
    }
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2800);
    return () => clearInterval(t);
  }, [scanning]);

  return (
    <div className={cn("relative w-full overflow-hidden rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-[#EFE7DD]", className)} style={{ aspectRatio: "4 / 3" }}>
      {image ? (
        <img src={image} alt="Your prescription" className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <>
          <PadIllustration />
          <div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
            <span className="rounded-full border border-[rgba(20,20,20,0.08)] bg-white/85 px-3.5 py-1.5 text-center text-[12px] font-medium text-orza-strong shadow-orza-glass backdrop-blur-orza">
              Lay it flat in good light — the whole page in frame
            </span>
          </div>
        </>
      )}

      <AnimatePresence>
        {scanning && (
          <motion.div key="scan" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(7,9,12,0.18) 0%, rgba(7,9,12,0.40) 100%)" }} />
            {!reduce && (
              <motion.div
                className="absolute inset-x-0 h-[2px]"
                style={{ background: "linear-gradient(90deg, rgba(47,210,240,0), rgba(47,210,240,0.9), rgba(47,210,240,0))", boxShadow: "0 0 14px rgba(47,210,240,0.65)" }}
                initial={{ top: "5%" }}
                animate={{ top: ["5%", "95%", "5%"] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className="absolute inset-x-0 bottom-4 flex justify-center px-4 sm:bottom-6">
              <span role="status" aria-live="polite" className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[12px] font-medium text-orza-strong shadow-orza-floating">
                <Loader2 size={13} className="shrink-0 animate-spin text-[#0B8FA6]" aria-hidden />
                <span className="truncate">{STEPS[step]}…</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Brackets active={scanning} />
    </div>
  );
}
