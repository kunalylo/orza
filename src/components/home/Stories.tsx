import { ArrowDown, Briefcase, Heart, Leaf, Moon, Shield, Target, type LucideIcon } from "lucide-react";
import { GlassCard, IconTile, Section, SectionHeader } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";

type Story = {
  persona: string;
  icon: LucideIcon;
  tone: "cyan" | "energy" | "violet" | "neutral";
  challenge: string;
  solution: string;
};

const STORIES: Story[] = [
  {
    persona: "Busy Professional",
    icon: Briefcase,
    tone: "cyan",
    challenge: "Desk job, irregular meals, stress eating",
    solution: "Movement reminders, quick meal logging, stress-aware planning",
  },
  {
    persona: "Healthcare Worker",
    icon: Moon,
    tone: "violet",
    challenge: "Night shifts, high stress, energy crashes",
    solution: "Shift-aware meal timing, sleep-recovery nutrition, energy optimization",
  },
  {
    persona: "Weight Loss Journey",
    icon: Target,
    tone: "energy",
    challenge: "Calorie tracking, motivation dips, plateaus",
    solution: "Supportive AI coach, weekly flex, compensation plans for special occasions",
  },
  {
    persona: "Vegetarian/Vegan",
    icon: Leaf,
    tone: "neutral",
    challenge: "B12, iron, protein tracking",
    solution: "Nutrient-focused tracking, supplement reminders, plant-based recipe suggestions",
  },
  {
    persona: "Couple Planning",
    icon: Heart,
    tone: "energy",
    challenge: "Shared meals, coordinated goals",
    solution: "Partner mode, shared meal logging, household meal planning",
  },
  {
    persona: "Caregiver",
    icon: Shield,
    tone: "cyan",
    challenge: "Managing elderly parent nutrition",
    solution: "Caregiver permissions, medication tracking, health report management",
  },
];

export function HomeStories() {
  return (
    <Section id="stories" tone="canvas">
      <SectionHeader
        eyebrow="Real-Life Stories"
        title={
          <>
            Built for <em className="italic">real people</em>, real lives
          </>
        }
        lead="Whatever your lifestyle, ÖRZA adapts to support your unique wellness journey."
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3 lg:gap-5">
        {STORIES.map((s, i) => {
          const Icon = s.icon;
          return (
            <Reveal as="li" key={s.persona} delay={0.05 * (i % 3)} className="h-full">
              <GlassCard hover className="group flex h-full flex-col hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <IconTile tone={s.tone}>
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </IconTile>
                  <h3 className="font-editorial text-xl font-semibold tracking-[-0.01em] text-orza-strong">{s.persona}</h3>
                </div>

                <div className="mt-5 rounded-orza-sm border border-[rgba(20,20,20,0.06)] bg-white/45 p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Challenge</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-orza-muted">{s.challenge}</p>
                </div>

                <div className="flex justify-center py-1.5" aria-hidden>
                  <ArrowDown size={14} strokeWidth={1.75} className="text-orza-subtle transition-colors duration-220 ease-orza group-hover:text-orza-cyan-600" />
                </div>

                <div className="flex-1 rounded-orza-sm border border-orza-cyan/25 bg-orza-cyan-50/70 p-3.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-cyan-700">ÖRZA Solution</div>
                  <p className="mt-1 text-[14px] font-medium leading-relaxed text-orza-strong">{s.solution}</p>
                </div>
              </GlassCard>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}
