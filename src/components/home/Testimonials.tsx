import { Quote, Star } from "lucide-react";
import { GlassCard, Section, SectionHeader } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Wellness Coach",
    quote: "The AI food scanner is incredibly accurate. It understands my diet restrictions and suggests perfect alternatives.",
    avatar: "bg-gradient-to-br from-orza-cyan-200 to-orza-cyan",
  },
  {
    name: "Marcus Johnson",
    role: "Fitness Trainer",
    quote: "Game changer for my clients. The compensation plans after cheat days keep them motivated and on track.",
    avatar: "bg-orza-energy",
  },
  {
    name: "Priya Sharma",
    role: "Nutritionist",
    quote: "Finally, an AI that understands global cuisines. The multilingual support makes it accessible to all my clients.",
    avatar: "bg-gradient-to-br from-orza-violet-300 to-orza-violet",
  },
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function HomeTestimonials() {
  return (
    <Section id="testimonials" tone="canvas" className="overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[720px] max-w-full -translate-x-1/2 rounded-full opacity-70"
        style={{ background: "radial-gradient(ellipse at center, rgba(255,180,84,0.14) 0%, rgba(255,95,162,0.06) 40%, rgba(251,247,241,0) 70%)" }}
      />
      <SectionHeader
        align="center"
        className="relative"
        eyebrow="Trusted Worldwide"
        title={
          <>
            Loved by <em className="italic">health enthusiasts</em>
          </>
        }
        lead="Join thousands who transformed their wellness journey with örza's AI-powered insights."
      />

      <ul className="relative mt-10 grid items-start gap-4 md:grid-cols-3 lg:mt-14 lg:gap-6">
        {TESTIMONIALS.map((t, i) => (
          <Reveal as="li" key={t.name} delay={0.08 * i} className={cn(i === 1 && "md:mt-8")}>
            <GlassCard as="figure" hover className="flex h-full flex-col">
              <div className="flex items-center justify-between">
                <Quote size={22} strokeWidth={1.5} className="text-orza-coral" aria-hidden />
                <div className="flex gap-0.5" role="img" aria-label="Rated 5 out of 5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} size={13} strokeWidth={0} className="fill-orza-amber" aria-hidden />
                  ))}
                </div>
              </div>
              <blockquote className="mt-4 flex-1 font-editorial text-[18px] leading-[1.55] text-orza-strong sm:text-[19px]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-[rgba(20,20,20,0.08)] pt-4">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-editorial text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
                    t.avatar
                  )}
                >
                  {initials(t.name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-orza-strong">{t.name}</span>
                  <span className="block font-mono text-[11px] uppercase tracking-[0.12em] text-orza-subtle">{t.role}</span>
                </span>
              </figcaption>
            </GlassCard>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
