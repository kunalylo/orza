import Link from "next/link";
import { AlertTriangle, Eye, Lock, Shield, UserCheck, type LucideIcon } from "lucide-react";
import { GlassCard, IconTile, Section, SectionHeader } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";

const PILLARS: { icon: LucideIcon; tone: "cyan" | "violet" | "energy" | "neutral"; title: string; desc: string }[] = [
  {
    icon: Shield,
    tone: "cyan",
    title: "Wellness Guidance, Not Diagnosis",
    desc: "We provide supportive nutrition insights. For medical concerns, always consult your doctor.",
  },
  {
    icon: Lock,
    tone: "violet",
    title: "Your Data, Encrypted & Private",
    desc: "End-to-end encryption. Your health data is never sold to third parties.",
  },
  {
    icon: Eye,
    tone: "energy",
    title: "Permission-Based Sharing",
    desc: "Household modes require explicit permission. You control what's shared, always.",
  },
  {
    icon: UserCheck,
    tone: "neutral",
    title: "Doctor-Friendly Platform",
    desc: "Designed to complement professional care, not replace it. Export reports for your doctor.",
  },
];

export function HomeTrust() {
  return (
    <Section id="trust" tone="raised">
      <SectionHeader
        eyebrow="Trust & Safety"
        title={
          <>
            Your health. Your <em className="italic">privacy</em>. Your choice.
          </>
        }
        lead="Built with medical boundaries, data security, and transparent practices at the core."
      />

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4 lg:gap-5">
        {PILLARS.map((p, i) => {
          const Icon = p.icon;
          return (
            <Reveal as="li" key={p.title} delay={0.06 * i} className="h-full">
              <GlassCard hover className="flex h-full flex-col">
                <IconTile tone={p.tone}>
                  <Icon size={18} strokeWidth={1.75} aria-hidden />
                </IconTile>
                <h3 className="mt-4 font-editorial text-[19px] font-semibold leading-snug tracking-[-0.01em] text-orza-strong">{p.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-orza-muted">{p.desc}</p>
              </GlassCard>
            </Reveal>
          );
        })}
      </ul>

      {/* Medical disclaimer (verbatim) */}
      <Reveal className="mt-6 lg:mt-8">
        <GlassCard
          variant="strong"
          padded={false}
          role="note"
          aria-labelledby="home-medical-disclaimer"
          className="relative overflow-hidden border-[rgba(176,106,0,0.22)] p-6 sm:p-8 lg:p-10"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(135deg, rgba(255,244,230,0.85) 0%, rgba(255,244,230,0.25) 45%, rgba(255,255,255,0) 75%)" }}
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <IconTile className="h-12 w-12 border-[rgba(176,106,0,0.25)] bg-[#FFF4E6] text-orza-warning">
              <AlertTriangle size={20} strokeWidth={1.75} aria-hidden />
            </IconTile>
            <div className="min-w-0 flex-1">
              <h3 id="home-medical-disclaimer" className="font-editorial text-2xl font-semibold tracking-[-0.01em] text-orza-strong">
                Important Medical Disclaimer
              </h3>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-orza-muted">
                <p>
                  <strong className="font-semibold text-orza-strong">ÖRZA is a wellness guidance platform, not a medical diagnostic tool.</strong>{" "}
                  We do not diagnose diseases, prescribe medication, or replace professional healthcare.
                </p>
                <p>
                  All health insights are for informational and wellness support purposes only. If you have medical concerns, are taking
                  medications, or have a diagnosed condition, please consult your doctor before making dietary or lifestyle changes.
                </p>
              </div>
              <ul className="mt-5 grid gap-3 md:grid-cols-2">
                <li className="flex items-start gap-3 rounded-orza-sm border border-[rgba(18,122,86,0.22)] bg-[#EAF7F1]/80 px-4 py-3 text-[14px] leading-relaxed text-orza-strong">
                  <span aria-hidden className="leading-6">✅</span>
                  <span>
                    <strong className="font-semibold">Use ÖRZA for:</strong> Nutrition tracking, meal planning, wellness insights
                  </span>
                </li>
                <li className="flex items-start gap-3 rounded-orza-sm border border-[rgba(176,44,44,0.20)] bg-[#FDECEC]/80 px-4 py-3 text-[14px] leading-relaxed text-orza-strong">
                  <span aria-hidden className="leading-6">❌</span>
                  <span>
                    <strong className="font-semibold">Do NOT use ÖRZA for:</strong> Medical diagnosis, treatment decisions, emergency health
                    situations
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </GlassCard>
      </Reveal>

      {/* Security statement */}
      <Reveal delay={0.1} className="mt-4">
        <GlassCard
          variant="subtle"
          padded={false}
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
        >
          <p className="flex items-start gap-3 text-[14px] leading-relaxed text-orza-muted">
            <Lock size={16} strokeWidth={1.75} className="mt-[3px] shrink-0 text-orza-cyan-600" aria-hidden />
            <span>All data encrypted in transit and at rest. SOC 2 compliant infrastructure. GDPR-ready data rights.</span>
          </p>
          <Link
            href="/privacy"
            className="shrink-0 pl-7 text-[14px] font-medium text-orza-cyan-600 underline-offset-4 transition-colors duration-150 ease-orza hover:text-orza-cyan-700 hover:underline sm:pl-0"
          >
            View Privacy Policy →
          </Link>
        </GlassCard>
      </Reveal>
    </Section>
  );
}
