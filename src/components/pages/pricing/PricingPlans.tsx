"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, BellRing, Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, GlassCard, IconTile, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Button, ButtonLink } from "@/components/ui/button";
import { annualSaving, buildPlans, inr, maxAnnualSaving, type CreditFacts, type Plan } from "./plans";
import { WaitlistDialog } from "./WaitlistDialog";

type Billing = "monthly" | "annual";

const BILLING_OPTIONS: { value: Billing; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

/** Monthly / annual switch — a radiogroup with a sliding pill (arrow keys move the selection). */
function BillingToggle({ value, onChange, maxSaving }: { value: Billing; onChange: (v: Billing) => void; maxSaving: number }) {
  const reduce = useReducedMotion();
  const refs = React.useRef<Record<Billing, HTMLButtonElement | null>>({ monthly: null, annual: null });

  function onKeyDown(e: React.KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next: Billing = value === "monthly" ? "annual" : "monthly";
    onChange(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      onKeyDown={onKeyDown}
      className="inline-flex rounded-full border border-[rgba(20,20,20,0.10)] bg-white/65 p-1 shadow-orza-glass backdrop-blur-orza"
    >
      {BILLING_OPTIONS.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[o.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className="relative z-0 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium sm:px-5"
          >
            {on && (
              <motion.span
                layoutId="orza-billing-pill"
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-[#141414] shadow-orza-cta"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className={cn("transition-colors duration-150", on ? "text-orza-bg-0" : "text-orza-muted hover:text-orza-strong")}>
              {o.label}
            </span>
            {o.value === "annual" && maxSaving > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-150",
                  on ? "bg-white/15 text-orza-cream" : "bg-[#FFF1EA] text-[#C2410C]"
                )}
              >
                Save up to {maxSaving}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PlanPrice({ plan, billing }: { plan: Plan; billing: Billing }) {
  const reduce = useReducedMotion();
  const annual = billing === "annual" && plan.annual ? plan.annual : null;
  const amount = annual ? annual.total : plan.monthly;
  const period = plan.periodLabel ?? (annual ? "/year" : "/month");

  let note: string;
  if (!plan.annual) note = "Manual logging is always free";
  else if (annual) note = `${inr(annual.perMonth)}/month, billed yearly · save ${annualSaving(plan)}%`;
  else note = `or ${inr(plan.annual.total)}/year (${inr(plan.annual.perMonth)}/month)`;

  return (
    <div className="mt-6">
      <div className="flex items-baseline gap-2">
        <motion.span
          key={amount}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-editorial text-[44px] font-semibold leading-none tracking-[-0.02em] text-orza-strong tabular-nums"
        >
          {inr(amount)}
        </motion.span>
        <span className="text-sm text-orza-muted">{period}</span>
      </div>
      <p className={cn("mt-2.5 text-[13px] font-medium", plan.annual ? "text-orza-cyan-600" : "text-orza-subtle")}>
        {note}
      </p>
    </div>
  );
}

/** `featureCols`: "two" splits the feature list from sm up; "tablet" only while the card spans two columns (sm–md). */
function PlanCard({
  plan,
  billing,
  featureCols = "one",
  joined,
  onJoin,
}: {
  plan: Plan;
  billing: Billing;
  featureCols?: "one" | "two" | "tablet";
  /** True once this visitor has joined the plan's waitlist in this visit. */
  joined: boolean;
  onJoin: (plan: Plan) => void;
}) {
  const wide = featureCols !== "one";
  const Icon = plan.icon;
  return (
    <GlassCard
      variant={plan.highlight ? "strong" : "base"}
      padded={false}
      className={cn(
        "relative flex h-full flex-col p-6 sm:p-8",
        plan.highlight && "shadow-orza-glass-hover ring-1 ring-[rgba(11,190,220,0.30)]"
      )}
    >
      {plan.highlight && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-orza-md">
            <div
              className="absolute -right-24 -top-24 h-72 w-72 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(255,180,84,0.26) 0%, rgba(255,122,106,0.12) 40%, rgba(255,95,162,0) 70%)",
                filter: "blur(8px)",
              }}
            />
          </div>
          <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full bg-orza-energy px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(255,122,106,0.35)]">
            <Sparkles size={12} strokeWidth={2} aria-hidden />
            Recommended
          </span>
        </>
      )}

      <div className="relative flex items-start gap-3">
        <IconTile tone={plan.highlight ? "cyan" : plan.id === "free" ? "neutral" : "violet"}>
          <Icon size={18} strokeWidth={1.75} aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <h3 className="font-editorial text-[22px] font-semibold leading-tight tracking-[-0.01em] text-orza-strong">{plan.name}</h3>
          <p className="mt-1 text-sm text-orza-muted">{plan.desc}</p>
          {!plan.available && (
            <Tag tone="violet" size="sm" className="mt-2.5">
              Launching soon
            </Tag>
          )}
        </div>
      </div>

      <div className="relative">
        <PlanPrice plan={plan} billing={billing} />
      </div>

      {plan.available ? (
        <ButtonLink
          href="/login?mode=signup"
          variant={plan.highlight ? "primary" : "secondary"}
          size="lg"
          className="relative mt-6 w-full"
          aria-label={`${plan.cta} — ${plan.name}`}
        >
          {plan.cta} <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
        </ButtonLink>
      ) : (
        <Button
          type="button"
          variant={plan.highlight ? "primary" : "secondary"}
          size="lg"
          className="relative mt-6 w-full"
          onClick={() => onJoin(plan)}
          disabled={joined}
          aria-label={joined ? `On the ${plan.name} waitlist` : `${plan.cta} — ${plan.name}`}
        >
          {joined ? (
            <>
              <Check size={15} strokeWidth={2} aria-hidden /> You&rsquo;re on the waitlist
            </>
          ) : (
            <>
              <BellRing size={14} strokeWidth={1.75} aria-hidden /> {plan.cta}
            </>
          )}
        </Button>
      )}

      <div aria-hidden className="relative mt-7 h-px bg-[rgba(20,20,20,0.08)]" />

      <ul
        aria-label={`${plan.name} features`}
        className={cn(
          "relative mt-6 grid content-start gap-3",
          featureCols === "two" && "sm:grid-cols-2 sm:gap-x-6",
          featureCols === "tablet" && "sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-1"
        )}
      >
        {plan.features.map((f) => {
          // Lines like "Everything in Free, plus:" introduce the list rather than being a feature.
          if (f.text.endsWith(":")) {
            return (
              <li
                key={f.text}
                className={cn(
                  "font-mono text-[11px] uppercase tracking-[0.12em] text-orza-subtle",
                  wide && "sm:col-span-2",
                  featureCols === "tablet" && "lg:col-span-1"
                )}
              >
                {f.text}
              </li>
            );
          }
          return (
            <li key={f.text} className="flex items-start gap-2.5 text-[14px] leading-snug">
              {f.included ? (
                <Check size={16} strokeWidth={2} className="mt-px shrink-0 text-[#0B8FA6]" aria-hidden />
              ) : (
                <X size={16} strokeWidth={1.75} className="mt-px shrink-0 text-[rgba(20,20,20,0.28)]" aria-hidden />
              )}
              <span className={f.included ? "text-orza-strong/85" : "text-orza-subtle"}>
                {!f.included && <span className="sr-only">Not included: </span>}
                {f.text}
              </span>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

/**
 * Billing toggle + all plans: Free & Individual first, then the household plans.
 * `credits` carries the live sign-up grant and per-action costs from the server (the credit module is server-only).
 */
export function PricingPlans({ credits }: { credits: CreditFacts }) {
  const [billing, setBilling] = React.useState<Billing>("monthly");
  const [announce, setAnnounce] = React.useState("");
  const [waitlistPlan, setWaitlistPlan] = React.useState<Plan | null>(null);
  const [joined, setJoined] = React.useState<Set<string>>(() => new Set());
  const plans = React.useMemo(() => buildPlans(credits), [credits]);
  const maxSaving = maxAnnualSaving(plans);
  const core = plans.filter((p) => p.group === "core");
  const household = plans.filter((p) => p.group === "household");
  const oddLast = household.length % 2 === 1;

  function changeBilling(v: Billing) {
    setBilling(v);
    setAnnounce(v === "annual" ? "Showing annual prices, billed yearly." : "Showing monthly prices.");
  }

  return (
    <div>
      <Reveal className="flex flex-col items-center gap-3 text-center">
        <BillingToggle value={billing} onChange={changeBilling} maxSaving={maxSaving} />
        <p className="max-w-md text-[13px] text-orza-subtle">
          Prices in Indian Rupees. Premium plans are launching soon — join a waitlist and we&rsquo;ll tell you when they open.
          Nothing is charged today.
        </p>
      </Reveal>
      <p role="status" className="sr-only">
        {announce}
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {core.map((plan, i) => (
          <Reveal key={plan.id} delay={0.06 * i} className="h-full">
            <PlanCard plan={plan} billing={billing} featureCols="two" joined={joined.has(plan.id)} onJoin={setWaitlistPlan} />
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-16">
        <Eyebrow>Household modes</Eyebrow>
        <h2 className="mt-2 font-editorial text-[26px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[30px]">
          Built for couples, caregivers, and families
        </h2>
      </Reveal>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {household.map((plan, i) => (
          <Reveal
            key={plan.id}
            delay={0.06 * i}
            className={cn("h-full", oddLast && i === household.length - 1 && "sm:col-span-2 lg:col-span-1")}
          >
            <PlanCard
              plan={plan}
              billing={billing}
              featureCols={oddLast && i === household.length - 1 ? "tablet" : "one"}
              joined={joined.has(plan.id)}
              onJoin={setWaitlistPlan}
            />
          </Reveal>
        ))}
      </div>

      <WaitlistDialog
        plan={waitlistPlan}
        onOpenChange={(open) => !open && setWaitlistPlan(null)}
        onJoined={(id) => setJoined((prev) => new Set(prev).add(id))}
      />
    </div>
  );
}
