import * as React from "react";
import { Check, Heart, Leaf, Shield, User, Users, type LucideIcon } from "lucide-react";
import { Eyebrow, GlassCard, IconTile, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  annual?: string;
  desc: string;
  icon: LucideIcon;
  features: string[];
  highlight?: boolean;
  current?: boolean;
};

/** Plan preview — copy from the ÖRZA pricing page. Payments aren't live yet, so there is no checkout here. */
const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free Forever",
    price: "₹0",
    period: "Always free",
    desc: "Perfect for trying ÖRZA and basic tracking",
    icon: Leaf,
    features: ["Manual meal, step, water, weight logging", "Basic dashboard & charts", "Goal setting & calorie targets"],
    current: true,
  },
  {
    id: "individual",
    name: "Premium Individual",
    price: "₹299",
    period: "/month",
    annual: "₹2,499/year (₹208/month)",
    desc: "Solo users serious about health",
    icon: User,
    features: ["Unlimited AI actions", "Voice meal logging (3 languages)", "Camera food scanning", "Recipe generation"],
    highlight: true,
  },
  {
    id: "couple",
    name: "Premium Couple",
    price: "₹499",
    period: "/month",
    annual: "₹4,199/year (₹350/month)",
    desc: "Couples managing health together",
    icon: Heart,
    features: ["All Individual features × 2 users", "Shared meal logging", "Coordinated goals"],
  },
  {
    id: "caregiver",
    name: "Premium Caregiver",
    price: "₹399",
    period: "/month",
    annual: "₹3,499/year (₹291/month)",
    desc: "Caregivers supporting dependents",
    icon: Shield,
    features: ["All Individual features", "Log for 1 dependent", "Health report tracking"],
  },
  {
    id: "family",
    name: "Premium Family",
    price: "₹699",
    period: "/month",
    annual: "₹5,999/year (₹500/month)",
    desc: "Families of 3-6 people",
    icon: Users,
    features: ["Up to 5 family members", "Separate profiles", "Family dashboard"],
  },
];

export function PlansPreview({ requested, onRequest, className }: { requested: boolean; onRequest: () => void; className?: string }) {
  return (
    <section aria-labelledby="plans-title" className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow>Plans</Eyebrow>
          <h2 id="plans-title" className="mt-2 font-editorial text-[26px] font-semibold leading-8 tracking-[-0.02em] text-orza-strong sm:text-[30px] sm:leading-[38px]">
            Plans that grow with your <em className="orza-energy-text pr-[0.06em] italic">wellness journey</em>
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-orza-muted">
            Start free. Upgrade when ready. Online payments are coming soon — until then, ask us and we&rsquo;ll top up your credits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="violet">Online payments coming soon</Tag>
          <Button variant="secondary" size="sm" onClick={onRequest} disabled={requested}>
            {requested ? "Request sent" : "Request more credits"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {PLANS.map((plan, i) => {
          const Icon = plan.icon;
          return (
            <Reveal key={plan.id} delay={i * 0.05} className={cn("h-full", plan.current && "sm:col-span-2 xl:col-span-1")}>
              <GlassCard
                variant={plan.highlight ? "strong" : "base"}
                padded={false}
                className={cn(
                  "relative flex h-full flex-col p-5",
                  plan.highlight && "ring-1 ring-[rgba(11,190,220,0.28)]",
                  plan.current && "bg-[rgba(255,241,234,0.72)] border-[rgba(255,122,106,0.28)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <IconTile tone={plan.current ? "energy" : plan.highlight ? "cyan" : "neutral"} className="h-9 w-9">
                    <Icon size={16} strokeWidth={1.75} aria-hidden />
                  </IconTile>
                  {plan.current ? (
                    <Tag tone="energy" size="sm">
                      Your plan
                    </Tag>
                  ) : plan.highlight ? (
                    <Tag tone="info" size="sm">
                      Most popular
                    </Tag>
                  ) : null}
                </div>
                <h3 className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{plan.name}</h3>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-editorial text-[32px] font-semibold leading-none tracking-[-0.02em] text-orza-strong">{plan.price}</span>
                  <span className="text-[13px] text-orza-muted">{plan.period}</span>
                </div>
                {plan.annual && <p className="mt-1.5 text-[12px] font-medium text-[#0B8FA6]">{plan.annual}</p>}
                <p className="mt-3 text-[13px] leading-snug text-orza-muted">{plan.desc}</p>
                <ul className="mt-4 flex flex-1 flex-col gap-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] leading-snug text-orza-strong/85">
                      <Check size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-[#0B8FA6]" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </Reveal>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-orza-subtle">Prices shown are a preview. Nothing is charged today — ÖRZA has no card payments yet.</p>
    </section>
  );
}
