import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Sparkles, Zap } from "lucide-react";
import { Eyebrow, GlassCard, Heading, Section, SectionHeader, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Accent, PageHero } from "@/components/pages/PageHero";
import { CtaCard } from "@/components/pages/CtaCard";
import { FaqAccordion } from "@/components/pages/FaqAccordion";
import { PricingPlans } from "@/components/pages/pricing/PricingPlans";
import { CreditsExplainer } from "@/components/pages/pricing/CreditsExplainer";
import { PRICING_FAQ, TOP_UPS, inr } from "@/components/pages/pricing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent ÖRZA pricing. Start free forever, or choose Premium Individual, Couple, Caregiver or Family. Upgrade when ready. Cancel anytime. No hidden fees.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "ÖRZA Pricing — Plans that grow with your wellness journey",
    description: "Start free. Upgrade when ready. Cancel anytime. No hidden fees.",
  },
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        align="center"
        eyebrow="Transparent Pricing"
        icon={<Sparkles size={12} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />}
        title={
          <>
            Plans that grow with your <Accent>wellness journey</Accent>
          </>
        }
        lead="Start free. Upgrade when ready. Cancel anytime. No hidden fees."
      />

      {/* Plans */}
      <Section tone="canvas" className="pt-0 md:pt-0 lg:pt-0" aria-label="Plans">
        <PricingPlans />
        <div className="mt-12">
          <CreditsExplainer />
        </div>
      </Section>

      {/* AI top-ups */}
      <Section tone="raised" id="top-ups">
        <SectionHeader
          eyebrow={
            <span className="inline-flex items-center gap-2">
              <Zap size={12} strokeWidth={1.75} className="text-[#6E3ED6]" aria-hidden />
              AI Top-Ups
            </span>
          }
          title="Need more AI actions?"
          lead="For Free users hitting monthly limits or occasional heavy use"
        />
        <ul className="mt-10 grid gap-5 md:grid-cols-3 lg:mt-14">
          {TOP_UPS.map((t, i) => (
            <Reveal as="li" key={t.name} delay={0.06 * i} className="h-full">
              <GlassCard hover padded={false} className="relative flex h-full flex-col overflow-hidden p-6 sm:p-7">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(135,87,242,0.14) 0%, rgba(135,87,242,0) 70%)" }}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <h3 className="font-mono text-[12px] uppercase tracking-[0.14em] text-orza-muted">{t.name}</h3>
                  <Tag tone="violet" size="sm">
                    Valid {t.validity}
                  </Tag>
                </div>
                <div className="relative mt-5 font-editorial text-[44px] font-semibold leading-none tracking-[-0.02em] text-orza-strong tabular-nums">
                  {inr(t.price)}
                </div>
                <p className="relative mt-3 text-[15px] font-medium text-orza-strong">{t.actions} actions</p>
                <p className="relative mt-1 text-[13px] text-orza-subtle">
                  ≈ ₹{(t.price / t.actions).toFixed(2)} per action
                </p>
              </GlassCard>
            </Reveal>
          ))}
        </ul>
      </Section>

      {/* Pricing FAQ */}
      <Section tone="canvas" id="pricing-faq">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Eyebrow>Questions</Eyebrow>
            <Heading className="mt-3">Pricing FAQ</Heading>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-orza-muted">
              Looking for something else? Browse every answer about food intelligence, household modes and privacy.
            </p>
            <Link
              href="/faq"
              className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-full border border-[rgba(20,20,20,0.12)] bg-white/60 px-5 text-sm font-medium text-orza-strong transition-colors duration-150 ease-orza hover:bg-white"
            >
              All FAQs <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
          <Reveal>
            <FaqAccordion items={PRICING_FAQ} idPrefix="pricing-faq" defaultOpen={[0]} />
          </Reveal>
        </div>
      </Section>

      {/* Closing CTA */}
      <Section tone="canvas" className="pt-0 md:pt-0 lg:pt-0">
        <CtaCard
          eyebrow="Begin"
          title="Ready to start your wellness journey?"
          lead="Join thousands using ÖRZA to transform their health"
          primary={{ label: "Get Started Free", href: "/login?mode=signup" }}
          secondary={{ label: "Trust & Safety", href: "/trust" }}
          rows={[
            { k: "Start free", v: "Manual tracking, always free" },
            { k: "Upgrade when ready", v: "7-day trial on Premium plans" },
            { k: "Cancel anytime", v: "No hidden fees" },
          ]}
        />
      </Section>
    </>
  );
}
