"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Heart, Lock, Shield, User, Users, type LucideIcon } from "lucide-react";
import { GlassCard, IconTile, Section, SectionHeader } from "@/components/orza/primitives";
import { cn } from "@/lib/utils";

type Access = "private" | "permission" | "shared";
type Mode = {
  id: string;
  label: string;
  icon: LucideIcon;
  desc: string;
  detail: string;
  includes: string[];
  access: [string, Access][];
};

const MODES: Mode[] = [
  {
    id: "individual",
    label: "Individual",
    icon: User,
    desc: "Personal AI wellness coach tailored to your goals",
    detail: "A personal AI wellness coach tailored to your goals. Your profile stays private unless you explicitly choose to share it.",
    includes: ["Voice meal logging (3 languages)", "Camera food scanning", "Advanced AI chat", "Recipe generation"],
    access: [
      ["Meals", "private"],
      ["Progress", "private"],
      ["Goals", "private"],
      ["Health reports", "private"],
    ],
  },
  {
    id: "couple",
    label: "Couple",
    icon: Heart,
    desc: "Shared meals, coordinated planning, partner notifications",
    detail: "Two linked accounts can log shared meals, see each other’s progress (with permission), and coordinate household planning.",
    includes: ["Shared meal logging", "Partner notifications", "Household meal planning", "Coordinated goals"],
    access: [
      ["Meals", "shared"],
      ["Progress", "permission"],
      ["Goals", "shared"],
      ["Health reports", "private"],
    ],
  },
  {
    id: "caregiver",
    label: "Caregiver",
    icon: Shield,
    desc: "Log for dependents, medication reminders, support routing",
    detail: "Made for managing an elderly parent’s nutrition. The caregiver can log meals, track meds, and manage health reports for the dependent.",
    includes: ["Log for 1 dependent", "Medication reminders", "Health report tracking", "Support routing"],
    access: [
      ["Meals", "permission"],
      ["Progress", "permission"],
      ["Goals", "private"],
      ["Health reports", "permission"],
    ],
  },
  {
    id: "family",
    label: "Family",
    icon: Users,
    desc: "Multi-profile, family meals, household health dashboard",
    detail: "Separate profiles plus shared planning — for households managing the nutrition of three or more people, from kids to parents.",
    includes: ["Separate profiles", "Family dashboard", "Shared pantry", "Family reports", "Parental controls"],
    access: [
      ["Meals", "shared"],
      ["Progress", "permission"],
      ["Goals", "private"],
      ["Health reports", "permission"],
    ],
  },
];

const ACCESS_STYLE: Record<Access, { label: string; className: string }> = {
  private: { label: "Private", className: "bg-orza-violet-50 text-[#5630A8] border-[rgba(135,87,242,0.22)]" },
  permission: { label: "By permission", className: "bg-orza-cyan-50 text-orza-cyan-700 border-[rgba(11,190,220,0.28)]" },
  shared: { label: "Shared", className: "bg-[#FFF1EA] text-[#C2410C] border-[rgba(255,122,106,0.30)]" },
};

export function HomeHousehold() {
  const [active, setActive] = React.useState(1); // Couple: the mode that best shows selective sharing
  const reduce = useReducedMotion();
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const mode = MODES[active];

  function onTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % MODES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + MODES.length) % MODES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = MODES.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <Section id="household" tone="raised">
      <SectionHeader
        eyebrow="For Everyone"
        title={
          <>
            Not just for you. <em className="italic">For your household</em>
          </>
        }
        lead="Individual, Couple, Caregiver, or Family modes — ÖRZA adapts to your household structure with role-based permissions and shared planning."
      />

      <div className="mt-10 grid gap-6 lg:mt-14 lg:grid-cols-[1fr_1.25fr] lg:gap-8">
        {/* Mode selector */}
        <div role="tablist" aria-label="Household modes" className="grid grid-cols-2 content-start gap-3">
          {MODES.map((m, i) => {
            const Icon = m.icon;
            const selected = i === active;
            return (
              <motion.button
                key={m.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`household-tab-${m.id}`}
                aria-selected={selected}
                aria-controls="household-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex h-full flex-col rounded-orza-md border p-4 text-left sm:p-5",
                  "transition-[background-color,box-shadow,border-color] duration-220 ease-orza",
                  selected
                    ? "border-orza-cyan/35 bg-[rgba(255,255,255,0.84)] shadow-orza-glass"
                    : "border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.74)]"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-220 ease-orza",
                    selected ? "bg-orza-cyan/15 text-orza-cyan-600" : "bg-white/70 text-orza-muted"
                  )}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="mt-3 font-editorial text-lg font-semibold tracking-[-0.01em] text-orza-strong">{m.label}</span>
                <span className="mt-1 text-[13px] leading-snug text-orza-muted">{m.desc}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Detail panel */}
        <GlassCard
          variant="strong"
          padded={false}
          role="tabpanel"
          id="household-panel"
          aria-labelledby={`household-tab-${mode.id}`}
          className="relative overflow-hidden p-6 sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-24 h-[320px] w-[320px] rounded-full"
            style={{
              background: "radial-gradient(circle at 40% 40%, rgba(47,210,240,0.16) 0%, rgba(191,168,255,0.10) 42%, rgba(251,247,241,0) 70%)",
              filter: "blur(8px)",
            }}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={mode.id}
              className="relative"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{mode.label} mode</span>
                <IconTile tone="cyan" className="h-9 w-9">
                  <mode.icon size={16} strokeWidth={1.75} aria-hidden />
                </IconTile>
              </div>
              <h3 className="mt-2 font-editorial text-2xl font-semibold tracking-[-0.015em] text-orza-strong sm:text-[28px] sm:leading-[1.2]">
                Private by default. Shared by permission.
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-orza-muted">{mode.detail}</p>

              <div className="mt-7 grid gap-6 sm:grid-cols-2">
                <div>
                  <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">What&apos;s included</h4>
                  <ul className="mt-3 grid gap-2">
                    {mode.includes.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[14px] text-orza-strong/90">
                        <Check size={14} strokeWidth={2} className="mt-[3px] shrink-0 text-orza-success" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">What&apos;s shared</h4>
                  <ul className="mt-3 grid gap-2">
                    {mode.access.map(([label, access]) => (
                      <li
                        key={label}
                        className="flex items-center justify-between gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/55 px-3 py-2"
                      >
                        <span className="text-[13px] text-orza-strong">{label}</span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-[1px] font-mono text-[10px] uppercase tracking-[0.12em]",
                            ACCESS_STYLE[access].className
                          )}
                        >
                          {ACCESS_STYLE[access].label}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <p className="mt-7 flex items-start gap-2 border-t border-[rgba(20,20,20,0.08)] pt-4 text-[13px] leading-relaxed text-orza-muted">
                <Lock size={14} strokeWidth={1.75} className="mt-[3px] shrink-0 text-orza-cyan-600" aria-hidden />
                <span>Household modes require explicit permission. You control what&apos;s shared, always — and can revoke access anytime.</span>
              </p>
            </motion.div>
          </AnimatePresence>
        </GlassCard>
      </div>
    </Section>
  );
}
