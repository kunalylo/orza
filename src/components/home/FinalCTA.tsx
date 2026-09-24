import { ArrowRight, Gift, MapPin, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Eyebrow, GlassCard, Section } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { ButtonLink } from "@/components/ui/button";

const PROMISES: { icon: LucideIcon; k: string; v: string }[] = [
  { icon: Sparkles, k: "Free forever", v: "Manual tracking & basic dashboard" },
  { icon: Gift, k: "100 AI credits", v: "Included when you sign up" },
  { icon: ShieldCheck, k: "Private by design", v: "Never sold to third parties" },
  { icon: MapPin, k: "India-first depth", v: "State-wise dishes & portions" },
];

export function HomeFinalCTA() {
  return (
    <Section id="get-started" tone="canvas">
      <Reveal>
        <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-7 sm:p-10 lg:p-14">
          {/* Warm energy glow — echoes the hero orb */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -right-24 h-[460px] w-[460px] rounded-full"
            style={{
              background: "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.38) 0%, rgba(255,122,106,0.18) 30%, rgba(255,95,162,0.10) 48%, rgba(0,0,0,0) 70%)",
              filter: "blur(10px)",
            }}
          />
          {/* Soft orb behind the frosted promise list (lg+) */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-[12%] top-[calc(50%-8rem)] hidden h-64 w-64 animate-orza-pulse rounded-full opacity-70 lg:block"
            style={{
              background: "radial-gradient(circle at 40% 40%, #FFE7C8 0%, rgba(255,180,84,0.85) 30%, rgba(255,122,106,0.45) 55%, rgba(255,95,162,0) 75%)",
              filter: "blur(18px)",
            }}
          />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
            <div>
              <Eyebrow>Begin</Eyebrow>
              <h2 className="mt-3 font-editorial text-[36px] font-semibold leading-[1.06] tracking-[-0.02em] text-orza-strong sm:text-[46px] lg:text-[56px]">
                Ready to feel better about <em className="orza-energy-text pr-1 italic">food</em>?
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-orza-muted sm:text-lg">
                Start free. No credit card. 100 AI credits included.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <ButtonLink href="/login?mode=signup" size="lg" className="px-7">
                  Begin Your Journey <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
                </ButtonLink>
                <ButtonLink href="/pricing" variant="secondary" size="lg">
                  See pricing
                </ButtonLink>
              </div>
            </div>

            <ul className="flex flex-col gap-3">
              {PROMISES.map((p) => {
                const Icon = p.icon;
                return (
                  <li
                    key={p.k}
                    className="flex items-center gap-3 rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/65 px-4 py-3 backdrop-blur-orza"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(255,122,106,0.28)] bg-[#FFF1EA] text-[#E0593F]">
                      <Icon size={15} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="text-[15px] font-medium text-orza-strong">{p.k}</span>
                      <span className="text-[13px] text-orza-muted sm:text-right">{p.v}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </GlassCard>
      </Reveal>
    </Section>
  );
}
