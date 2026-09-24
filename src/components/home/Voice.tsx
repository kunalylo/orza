import type { ReactNode } from "react";
import { Brain, Languages, MessageCircle, Mic, type LucideIcon } from "lucide-react";
import { Eyebrow, Heading, IconTile, Lead, Section } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { VoiceDemo } from "./_voiceDemo";

type Point = { icon: LucideIcon; tone: "energy" | "violet" | "cyan"; title: string; body: ReactNode };

const POINTS: Point[] = [
  {
    icon: MessageCircle,
    tone: "energy",
    title: "Conversational Intelligence",
    body: (
      <>
        <span className="font-medium italic text-orza-strong">&ldquo;Aaj maine breakfast mein do paratha aur dahi khaya&rdquo;</span> —
        ÖRZA understands and logs it automatically.
      </>
    ),
  },
  {
    icon: Languages,
    tone: "violet",
    title: "Multilingual Support",
    body: "Switch between English, Hindi, and Hinglish seamlessly. ÖRZA speaks your language.",
  },
  {
    icon: Brain,
    tone: "cyan",
    title: "Context-Aware",
    body: "Remembers your preferences, allergies, and goals. Every conversation builds on the last.",
  },
];

export function HomeVoice() {
  return (
    <Section id="voice" tone="raised" className="overflow-x-clip">
      {/* Soft warm wash behind the demo, echoing the hero orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 h-[520px] w-[520px] rounded-full opacity-80"
        style={{
          background: "radial-gradient(circle, rgba(255,180,84,0.16) 0%, rgba(255,95,162,0.07) 45%, rgba(246,240,232,0) 70%)",
          filter: "blur(10px)",
        }}
      />

      <div className="relative grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-14">
        {/* Left: story */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal>
            <Eyebrow className="inline-flex items-center gap-2">
              <Mic size={13} strokeWidth={1.75} className="text-orza-coral" aria-hidden />
              Voice AI
            </Eyebrow>
            <Heading className="mt-3">
              Talk to ÖRZA like a <em className="orza-energy-text pr-[0.06em] italic">friend</em>
            </Heading>
            <Lead className="mt-4 max-w-xl">
              Log meals, ask questions, get instant advice — all by voice. Supports English, Hindi, and Hinglish naturally.
            </Lead>
          </Reveal>

          <ul className="mt-8 divide-y divide-[rgba(20,20,20,0.08)] border-y border-[rgba(20,20,20,0.08)]">
            {POINTS.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal as="li" key={p.title} delay={0.06 + i * 0.06} className="flex items-start gap-4 py-5">
                  <IconTile tone={p.tone}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </IconTile>
                  <div className="min-w-0">
                    <h3 className="font-editorial text-[19px] font-semibold leading-6 tracking-[-0.01em] text-orza-strong">{p.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-orza-muted">{p.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </div>

        {/* Right: interactive command-center demo */}
        <Reveal delay={0.12} className="min-w-0">
          <VoiceDemo />
        </Reveal>
      </div>
    </Section>
  );
}
