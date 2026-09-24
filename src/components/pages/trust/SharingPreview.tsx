"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard, Tag } from "@/components/orza/primitives";

const BULLETS = [
  "Permission-based only",
  "You control what's shared",
  "Revoke access anytime",
  "Each profile remains private unless explicitly shared",
];

/** Illustrative scopes, drawn from what the household modes coordinate. */
const SCOPES = [
  { key: "meals", label: "Shared meals", scope: "Meals you log together", on: true },
  { key: "progress", label: "Progress", scope: "Goals, weight & streaks", on: false },
  { key: "reports", label: "Health reports", scope: "Uploaded reports & notes", on: false },
  { key: "meds", label: "Medication reminders", scope: "Reminders you set up", on: false },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors duration-220 ease-orza",
        checked ? "border-transparent bg-orza-cyan" : "border-[rgba(20,20,20,0.10)] bg-[rgba(20,20,20,0.12)]"
      )}
    >
      <motion.span
        aria-hidden
        className="absolute left-[2px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_6px_rgba(20,20,20,0.18)]"
        animate={{ x: checked ? 16 : 0 }}
        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }}
      />
    </button>
  );
}

/** "Household Sharing" card with a small interactive example of permission scopes (Couple mode). */
export function SharingPreview({ className }: { className?: string }) {
  const [state, setState] = React.useState<Record<string, boolean>>(() => Object.fromEntries(SCOPES.map((s) => [s.key, s.on])));
  const shared = SCOPES.filter((s) => state[s.key]).length;

  return (
    <GlassCard variant="strong" className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center gap-2">
        <Eye size={14} strokeWidth={1.75} className="text-[#0B8FA6]" aria-hidden />
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Permissions</div>
      </div>
      <h3 className="mt-2 font-editorial text-[24px] font-semibold tracking-[-0.01em] text-orza-strong">Household Sharing</h3>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {BULLETS.map((b) => (
          <li key={b} className="flex items-start gap-2 text-[14px] leading-snug text-orza-strong/85">
            <Check size={15} strokeWidth={2} className="mt-px shrink-0 text-[#0B8FA6]" aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex-1 rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-[rgba(246,240,232,0.6)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Example · Couple mode</span>
          <Tag tone="neutral" size="sm" dot={false}>
            Illustration
          </Tag>
        </div>
        <ul className="mt-3 grid gap-2" aria-label="Example sharing permissions">
          {SCOPES.map((s) => {
            const on = state[s.key];
            return (
              <li
                key={s.key}
                className={cn(
                  "flex items-center gap-3 rounded-orza-sm border px-3.5 py-2.5 transition-colors duration-150 ease-orza",
                  on ? "border-[rgba(11,190,220,0.25)] bg-white/85" : "border-[rgba(20,20,20,0.08)] bg-white/50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium text-orza-strong">{s.label}</div>
                  <div className="text-[12px] text-orza-muted">{s.scope}</div>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "w-14 text-right font-mono text-[10px] uppercase tracking-[0.14em]",
                    on ? "text-[#0B8FA6]" : "text-orza-subtle"
                  )}
                >
                  {on ? "Shared" : "Private"}
                </span>
                <Switch
                  checked={on}
                  label={`Share ${s.label.toLowerCase()} with your partner`}
                  onChange={() => setState((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                />
              </li>
            );
          })}
        </ul>
        <p className="mt-3 px-1 text-[12px] text-orza-muted" aria-live="polite">
          {shared === 0 ? "Nothing shared — your profile is fully private." : `${shared} of ${SCOPES.length} shared with your partner.`}
        </p>
      </div>
    </GlassCard>
  );
}
