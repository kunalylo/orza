import * as React from "react";
import { ArrowRight, Check } from "lucide-react";
import { Eyebrow, GlassCard } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { ButtonLink } from "@/components/ui/button";

type CtaLink = { label: string; href: string };

/** Closing call-to-action card with a warm halo, used at the end of marketing sub-pages. */
export function CtaCard({
  eyebrow,
  title,
  lead,
  primary,
  secondary,
  rows,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  primary: CtaLink;
  secondary?: CtaLink;
  rows?: { k: string; v: string }[];
}) {
  return (
    <Reveal>
      <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-7 sm:p-10 lg:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -right-24 h-[460px] w-[460px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.36) 0%, rgba(255,122,106,0.16) 32%, rgba(255,95,162,0.10) 50%, rgba(0,0,0,0) 70%)",
            filter: "blur(10px)",
          }}
        />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 className="mt-3 font-editorial text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-orza-strong sm:text-[42px] lg:text-[48px]">
              {title}
            </h2>
            {lead && <p className="mt-5 max-w-xl text-base leading-relaxed text-orza-muted sm:text-lg">{lead}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href={primary.href} size="lg" className="px-7">
                {primary.label} <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
              </ButtonLink>
              {secondary && (
                <ButtonLink href={secondary.href} variant="secondary" size="lg">
                  {secondary.label}
                </ButtonLink>
              )}
            </div>
          </div>

          {rows && rows.length > 0 && (
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <li
                  key={r.k}
                  className="flex items-center gap-3 rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/65 px-4 py-3 backdrop-blur-orza"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(11,190,220,0.25)] bg-[#E8FBFF] text-[#0B8FA6]">
                    <Check size={15} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="text-[15px] font-medium text-orza-strong">{r.k}</span>
                    <span className="text-[13px] text-orza-muted sm:text-right">{r.v}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlassCard>
    </Reveal>
  );
}
