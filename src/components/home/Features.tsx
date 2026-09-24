import { Activity, BookOpen, Brain, Camera, MessageCircle, Target, type LucideIcon } from "lucide-react";
import { GlassCard, IconTile, Section, SectionHeader, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";

type Feature = { icon: LucideIcon; tone: "cyan" | "violet" | "energy"; title: string; desc: string };

const FEATURES: Feature[] = [
  {
    icon: Camera,
    tone: "cyan",
    title: "Snap & Know",
    desc: "Photograph your meal — AI instantly estimates calories, protein, carbs, and fat from any global cuisine.",
  },
  {
    icon: MessageCircle,
    tone: "violet",
    title: "Speak Naturally",
    desc: "Chat with AI in your language — multilingual support makes tracking effortless and conversational.",
  },
  {
    icon: Brain,
    tone: "energy",
    title: "AI That Remembers",
    desc: "Your wellness companion learns your habits, preferences, and goals. Personalized advice that evolves with you.",
  },
  {
    icon: Target,
    tone: "cyan",
    title: "Smart Goals",
    desc: "Set targets and get intelligent recommendations. AI-powered planning adapts to your lifestyle and progress.",
  },
  {
    icon: BookOpen,
    tone: "energy",
    title: "Personalized Recipes",
    desc: "AI creates nutritious recipes tailored to your taste, dietary needs, and health goals from cuisines worldwide.",
  },
  {
    icon: Activity,
    tone: "violet",
    title: "Compassionate Rebalancing",
    desc: "Enjoyed a special meal? AI creates a supportive recovery plan — no guilt, just smart wellness strategies.",
  },
];

export function HomeFeatures() {
  return (
    <Section id="features" tone="canvas">
      <Reveal>
        <SectionHeader
          eyebrow="Features"
          title="Your wellness, intelligently managed"
          lead="From busy schedules to special occasions, ÖRZA adapts to your lifestyle with personalized health insights."
        />
      </Reveal>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 md:mt-12 lg:grid-cols-3">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <Reveal as="li" key={f.title} delay={(i % 3) * 0.06} className="h-full">
              <GlassCard hover className="group relative flex h-full flex-col overflow-hidden hover:-translate-y-0.5">
                {/* warm glow that blooms on hover */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-0 transition-opacity duration-500 ease-orza group-hover:opacity-100"
                  style={{ background: "radial-gradient(circle, rgba(255,180,84,0.20) 0%, rgba(255,95,162,0.06) 50%, rgba(0,0,0,0) 72%)" }}
                />
                <div className="relative flex items-center justify-between">
                  <IconTile tone={f.tone}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </IconTile>
                  <Tag tone="success" size="sm">
                    Available
                  </Tag>
                </div>
                <div className="relative mt-6 font-mono text-[11px] tracking-[0.14em] text-orza-subtle">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="relative mt-1.5 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
                  {f.title}
                </h3>
                <p className="relative mt-2 text-[15px] leading-relaxed text-orza-muted">{f.desc}</p>
              </GlassCard>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}
