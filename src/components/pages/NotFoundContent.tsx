import Link from "next/link";
import { ArrowUpRight, Compass, HelpCircle, Home, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { GlassCard, IconTile, Section } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { Accent, PageHero } from "@/components/pages/PageHero";

const DESTINATIONS: { href: string; icon: LucideIcon; title: string; desc: string }[] = [
  { href: "/", icon: Home, title: "Home", desc: "See how ÖRZA works — snap, chat and thrive." },
  { href: "/pricing", icon: Sparkles, title: "Pricing", desc: "Start free, with AI credits included." },
  { href: "/faq", icon: HelpCircle, title: "FAQ", desc: "Answers about food, voice, health data and privacy." },
  { href: "/trust", icon: ShieldCheck, title: "Trust & Safety", desc: "How your data stays private and in your control." },
];

/** Branded "page not found" body for the marketing site (rendered inside the site nav + footer). */
export function NotFoundContent() {
  return (
    <>
      <PageHero
        eyebrow="Error 404"
        icon={<Compass size={12} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />}
        title={
          <>
            This page took a <Accent>detour</Accent>
          </>
        }
        lead="The link may be old, or the address may have a typo. Everything else is right where you left it."
      >
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/" variant="primary" size="lg">
            Back to home <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </ButtonLink>
          <ButtonLink href="/dashboard" variant="secondary" size="lg">
            Open ÖRZA
          </ButtonLink>
        </div>
      </PageHero>

      <Section tone="canvas" className="pt-0 md:pt-0 lg:pt-0" aria-label="Popular pages">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DESTINATIONS.map((d, i) => {
            const Icon = d.icon;
            return (
              <Reveal as="li" key={d.href} delay={0.05 * i} className="h-full">
                <Link
                  href={d.href}
                  className="group block h-full rounded-orza-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/40"
                >
                  <GlassCard hover padded={false} className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <IconTile tone="cyan" className="h-9 w-9">
                        <Icon size={16} strokeWidth={1.75} aria-hidden />
                      </IconTile>
                      <ArrowUpRight
                        size={16}
                        strokeWidth={1.75}
                        className="text-orza-subtle transition-transform duration-220 ease-orza group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                    <div>
                      <p className="font-editorial text-lg font-semibold tracking-[-0.01em] text-orza-strong">{d.title}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-orza-muted">{d.desc}</p>
                    </div>
                  </GlassCard>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
