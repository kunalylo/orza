import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { SITE } from "@/lib/site";
import { Section } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Accent, PageHero } from "@/components/pages/PageHero";
import { FaqAccordion } from "@/components/pages/FaqAccordion";
import { ScrollSpyNav } from "@/components/pages/ScrollSpyNav";
import { FAQ_CATEGORIES, FAQ_TOTAL } from "@/components/pages/faq/faq-data";
import { StillHaveQuestions } from "@/components/pages/faq/StillHaveQuestions";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Everything you need to know about ÖRZA — Indian food intelligence, Hindi & Hinglish voice logging, health data, household modes, pricing, credits and privacy.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "ÖRZA — Frequently Asked Questions",
    description: "Everything you need to know about ÖRZA",
  },
};

/** schema.org FAQPage structured data for rich results. */
function faqJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_CATEGORIES.flatMap((c) =>
      c.items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } }))
    ),
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export default function FAQPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />

      <PageHero
        eyebrow="FAQ"
        icon={<MessageCircle size={12} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />}
        title={
          <>
            Frequently Asked <Accent>Questions</Accent>
          </>
        }
        lead="Everything you need to know about ÖRZA"
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-orza-subtle">
          {FAQ_TOTAL} answers · {FAQ_CATEGORIES.length} topics
        </p>
      </PageHero>

      <Section tone="canvas" className="pt-2 md:pt-4 lg:pt-6">
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
          {/* Category jump chips: sticky bar under the nav on mobile, sticky sidebar on desktop */}
          <aside className="sticky top-[68px] z-20 -mx-4 self-start border-b border-[rgba(20,20,20,0.06)] bg-[rgba(251,247,241,0.88)] px-4 py-3 backdrop-blur-orza sm:top-[76px] sm:-mx-6 sm:px-6 lg:top-28 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="mb-3 hidden font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle lg:block">Topics</div>
            <ScrollSpyNav
              label="FAQ topics"
              variant="chips"
              items={FAQ_CATEGORIES.map((c) => ({ id: c.id, label: c.title, count: c.items.length }))}
            />
            <div className="mt-8 hidden rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/50 p-4 lg:block">
              <p className="text-[13px] leading-relaxed text-orza-muted">Can&apos;t find what you need?</p>
              <a
                href={`mailto:${SITE.supportEmail}`}
                className="mt-1 inline-block break-all text-[13px] font-medium text-orza-cyan-600 underline-offset-4 hover:underline"
              >
                {SITE.supportEmail}
              </a>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col gap-14">
            {FAQ_CATEGORIES.map((cat, ci) => (
              <section key={cat.id} id={cat.id} aria-labelledby={`${cat.id}-title`} className="scroll-mt-36 lg:scroll-mt-28">
                <Reveal>
                  <div className="flex items-baseline gap-3 border-b border-[rgba(20,20,20,0.08)] pb-4">
                    <span aria-hidden className="font-mono text-[12px] tabular-nums text-orza-subtle">
                      {String(ci + 1).padStart(2, "0")}
                    </span>
                    <h2
                      id={`${cat.id}-title`}
                      className="font-editorial text-[24px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[28px]"
                    >
                      {cat.title}
                    </h2>
                    <span className="ml-auto shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-orza-subtle">
                      {cat.items.length} {cat.items.length === 1 ? "question" : "questions"}
                    </span>
                  </div>
                </Reveal>
                <Reveal delay={0.05}>
                  <FaqAccordion items={cat.items} idPrefix={cat.id} defaultOpen={ci === 0 ? [0] : []} className="mt-5" />
                </Reveal>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-20">
          <StillHaveQuestions />
        </div>
      </Section>
    </>
  );
}
