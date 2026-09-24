import { ArrowUpRight, Mail } from "lucide-react";
import { SITE } from "@/lib/site";
import { GlassCard, IconTile } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { ButtonLink, buttonVariants } from "@/components/ui/button";

/** Closing support card on the FAQ page. */
export function StillHaveQuestions() {
  return (
    <Reveal>
      <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-7 sm:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 h-[380px] w-[380px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.32) 0%, rgba(255,122,106,0.14) 34%, rgba(255,95,162,0.08) 52%, rgba(0,0,0,0) 70%)",
            filter: "blur(10px)",
          }}
        />
        <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <IconTile tone="energy">
              <Mail size={18} strokeWidth={1.75} aria-hidden />
            </IconTile>
            <h2 className="mt-4 font-editorial text-[28px] font-semibold leading-tight tracking-[-0.02em] text-orza-strong sm:text-[34px]">
              Still have questions?
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-orza-muted sm:text-base">
              Can&apos;t find the answer you&apos;re looking for? Write to us and we&apos;ll help you out.
            </p>
            <p className="mt-4 font-mono text-[12px] tracking-[0.06em] text-orza-subtle">{SITE.supportEmail}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
            <a href={`mailto:${SITE.supportEmail}`} className={buttonVariants({ size: "lg", className: "px-7" })}>
              <Mail size={16} strokeWidth={1.75} aria-hidden /> Email support
            </a>
            <ButtonLink href="/trust" variant="secondary" size="lg">
              Trust &amp; Safety <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
            </ButtonLink>
          </div>
        </div>
      </GlassCard>
    </Reveal>
  );
}
