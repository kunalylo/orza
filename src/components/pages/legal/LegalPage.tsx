import * as React from "react";
import { ArrowUpRight, CalendarDays, ChevronDown, ListTree, Mail, type LucideIcon } from "lucide-react";
import { SITE } from "@/lib/site";
import { GlassCard, IconTile, Section } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { PageHero } from "@/components/pages/PageHero";
import { ScrollSpyNav } from "@/components/pages/ScrollSpyNav";
import { SupportEmail } from "./prose";

import { LEGAL_UPDATED } from "./updated";

export { LEGAL_UPDATED };

export type LegalSection = { id: string; title: string; content: React.ReactNode };
export type LegalHighlight = { icon: LucideIcon; title: string; body: string };

const num = (i: number) => String(i + 1).padStart(2, "0");

function MetaChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 px-3 py-1.5 text-[13px] text-orza-muted backdrop-blur-orza">
      <Icon size={14} strokeWidth={1.75} className="text-orza-subtle" aria-hidden />
      {children}
    </span>
  );
}

/** Collapsible table of contents for small screens (the sticky TOC takes over from lg). */
function MobileToc({ sections }: { sections: LegalSection[] }) {
  return (
    <details className="group mb-10 rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-white/60 backdrop-blur-orza lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-orza-md px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(11,190,220,0.45)] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-muted">
          <ListTree size={14} strokeWidth={1.75} aria-hidden />
          On this page
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className="text-orza-muted transition-transform duration-220 ease-orza group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ol className="grid gap-0.5 border-t border-[rgba(20,20,20,0.08)] px-2 py-2">
        {sections.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="flex gap-3 rounded-orza-sm px-2 py-2 text-[14px] leading-snug text-orza-muted transition-colors duration-150 hover:bg-white/70 hover:text-orza-strong"
            >
              <span aria-hidden className="w-5 shrink-0 pt-px font-mono text-[11px] tabular-nums text-orza-subtle">
                {num(i)}
              </span>
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * Layout for the policy pages: hero with "last updated", optional "at a glance" highlights,
 * then numbered sections with a scroll-spy TOC and a contact card.
 */
export function LegalPage({
  docName,
  eyebrow,
  icon,
  title,
  lead,
  highlights,
  sections,
  related,
  contactSubject,
}: {
  /** Lower-case document name used in copy, e.g. "privacy policy". */
  docName: string;
  eyebrow: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  lead: React.ReactNode;
  highlights?: LegalHighlight[];
  sections: LegalSection[];
  related: { label: string; href: string }[];
  contactSubject: string;
}) {
  return (
    <>
      <PageHero eyebrow={eyebrow} icon={icon} title={title} lead={lead}>
        <div className="flex flex-wrap items-center gap-2">
          <MetaChip icon={CalendarDays}>
            Last updated: <time dateTime={LEGAL_UPDATED.iso}>{LEGAL_UPDATED.label}</time>
          </MetaChip>
          <MetaChip icon={ListTree}>{sections.length} sections</MetaChip>
        </div>
      </PageHero>

      <Section tone="canvas" className="pt-0 md:pt-0 lg:pt-0">
        {highlights && highlights.length > 0 && (
          <section aria-label="At a glance">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">At a glance</div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
              {highlights.map(({ icon: Icon, title: t, body }, i) => (
                <Reveal as="li" key={t} delay={0.05 * i} className="h-full">
                  <GlassCard padded={false} className="flex h-full gap-3.5 p-4 sm:p-5 lg:flex-col lg:gap-4">
                    <IconTile tone="cyan" className="h-9 w-9">
                      <Icon size={16} strokeWidth={1.75} aria-hidden />
                    </IconTile>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-snug text-orza-strong">{t}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-orza-muted">{body}</p>
                    </div>
                  </GlassCard>
                </Reveal>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-16">
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">On this page</div>
              <ScrollSpyNav
                variant="toc"
                label={`Sections of the ${docName}`}
                items={sections.map((s) => ({ id: s.id, label: s.title }))}
              />
            </div>
          </aside>

          <div className="min-w-0">
            <MobileToc sections={sections} />

            <article className="max-w-[740px]">
              {sections.map((s, i) => (
                <section
                  key={s.id}
                  id={s.id}
                  aria-labelledby={`${s.id}-title`}
                  className="scroll-mt-24 border-t border-[rgba(20,20,20,0.08)] py-10 first:border-t-0 first:pt-0 sm:py-12 sm:first:pt-0"
                >
                  <div className="flex items-baseline gap-3">
                    <span aria-hidden className="font-mono text-[12px] tabular-nums text-orza-subtle">
                      {num(i)}
                    </span>
                    <h2
                      id={`${s.id}-title`}
                      className="font-editorial text-[24px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[28px]"
                    >
                      {s.title}
                    </h2>
                  </div>
                  <div className="mt-5 flex flex-col gap-4">{s.content}</div>
                </section>
              ))}
            </article>

            <Reveal className="mt-6">
              <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-6 sm:p-8">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -bottom-28 -right-20 h-[320px] w-[320px] rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.30) 0%, rgba(255,122,106,0.13) 34%, rgba(255,95,162,0.07) 52%, rgba(0,0,0,0) 70%)",
                    filter: "blur(10px)",
                  }}
                />
                <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                  <div className="max-w-md">
                    <IconTile tone="energy">
                      <Mail size={18} strokeWidth={1.75} aria-hidden />
                    </IconTile>
                    <h2 className="mt-4 font-editorial text-[24px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[28px]">
                      Questions about this {docName}?
                    </h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-orza-muted">
                      Write to us at <SupportEmail subject={contactSubject} /> and we&apos;ll get back to you.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a
                      href={`mailto:${SITE.supportEmail}?subject=${encodeURIComponent(contactSubject)}`}
                      className={buttonVariants({ size: "lg", className: "px-7" })}
                    >
                      <Mail size={16} strokeWidth={1.75} aria-hidden /> Email us
                    </a>
                    {related.map((r) => (
                      <ButtonLink key={r.href} href={r.href} variant="secondary" size="lg">
                        {r.label} <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
                      </ButtonLink>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </div>
      </Section>
    </>
  );
}
