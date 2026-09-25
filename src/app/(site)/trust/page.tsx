import type { Metadata } from "next";
import {
  ArrowUpRight,
  Check,
  Eye,
  FileCheck2,
  FileText,
  Lock,
  Mail,
  Scale,
  Server,
  Shield,
  Stethoscope,
  TriangleAlert,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { SITE, pageMetadata } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Eyebrow, GlassCard, Heading, IconTile, Section, SectionHeader } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { ButtonLink, buttonVariants } from "@/components/ui/button";
import { Accent, PageHero } from "@/components/pages/PageHero";
import { SharingPreview } from "@/components/pages/trust/SharingPreview";

export const metadata: Metadata = pageMetadata({
  title: "Trust & Safety",
  description:
    "Your health. Your privacy. Your choice. ÖRZA is built with medical boundaries, data security and transparent practices at the core — encrypted, never sold, permission-based sharing.",
  path: "/trust",
  socialTitle: "ÖRZA Trust & Safety — Your health. Your privacy. Your choice.",
  socialDescription: "Built with medical boundaries, data security, and transparent practices at the core.",
});

/* Content: verbatim from the ÖRZA wellness app's Trust page. */

type Tone = "cyan" | "violet" | "energy" | "pink";

const TONES: Record<Tone, { pill: string; glow: string }> = {
  cyan: { pill: "border-[rgba(11,190,220,0.28)] bg-[rgba(11,190,220,0.10)] text-orza-cyan-700", glow: "rgba(47,210,240,0.16)" },
  violet: { pill: "border-[rgba(135,87,242,0.28)] bg-[rgba(135,87,242,0.10)] text-[#5630A8]", glow: "rgba(135,87,242,0.14)" },
  energy: { pill: "border-[rgba(255,180,84,0.35)] bg-[rgba(255,180,84,0.14)] text-orza-warning", glow: "rgba(255,180,84,0.22)" },
  pink: { pill: "border-[rgba(255,95,162,0.28)] bg-[rgba(255,95,162,0.10)] text-[#B0306F]", glow: "rgba(255,95,162,0.14)" },
};

const PILLARS: { icon: LucideIcon; tone: Tone; label: string; title: string; desc: string }[] = [
  {
    icon: Shield,
    tone: "cyan",
    label: "Boundaries",
    title: "Wellness Guidance, Not Diagnosis",
    desc: "We provide supportive nutrition insights. For medical concerns, always consult your doctor.",
  },
  {
    icon: Lock,
    tone: "violet",
    label: "Security",
    title: "Your Data, Encrypted & Private",
    desc: "End-to-end encryption. Your health data is never sold to third parties.",
  },
  {
    icon: Eye,
    tone: "energy",
    label: "Sharing",
    title: "Permission-Based Sharing",
    desc: "Household modes require explicit permission. You control what is shared, always.",
  },
  {
    icon: UserCheck,
    tone: "pink",
    label: "Care",
    title: "Doctor-Friendly Platform",
    desc: "Designed to complement professional care, not replace it. Export reports for your doctor.",
  },
];

const USE_FOR = ["Nutrition tracking", "Meal planning", "Wellness insights"];
const DONT_USE_FOR = ["Medical diagnosis", "Treatment decisions", "Emergency health situations"];

const YOUR_DATA = [
  "Encrypted at rest and in transit (TLS 1.3)",
  "Stored securely on SOC 2 compliant cloud infrastructure",
  "Never sold to third parties",
  "You can export or delete anytime",
];

const AI_TRAINING = [
  "Your conversations improve ÖRZA's AI",
  "Data is anonymized before training",
  "Opt-out available in Settings",
  "No personal health data sold",
];

const STANDARDS: { icon: LucideIcon; label: string }[] = [
  { icon: Scale, label: "GDPR-style data rights" },
  { icon: Server, label: "SOC 2 infrastructure" },
  { icon: Stethoscope, label: "Clear medical disclaimers" },
  { icon: FileCheck2, label: "Transparent privacy policy" },
];

/** Glass card with a mono label, editorial title and a checked list (Your Data, AI Training). */
function DetailCard({ icon: Icon, label, title, items }: { icon: LucideIcon; label: string; title: string; items: string[] }) {
  return (
    <GlassCard hover className="h-full">
      <div className="flex items-center gap-3">
        <IconTile tone="cyan">
          <Icon size={17} strokeWidth={1.75} aria-hidden />
        </IconTile>
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{label}</div>
          <h3 className="font-editorial text-[22px] font-semibold leading-tight tracking-[-0.01em] text-orza-strong">{title}</h3>
        </div>
      </div>
      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 sm:gap-x-6">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-[14px] leading-snug text-orza-strong/85">
            <Check size={15} strokeWidth={2} className="mt-px shrink-0 text-orza-cyan-600" aria-hidden />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

/** "Use ÖRZA for" / "Do NOT use ÖRZA for" card. */
function BoundaryCard({ kind, items }: { kind: "do" | "dont"; items: string[] }) {
  const ok = kind === "do";
  const Icon = ok ? Check : X;
  return (
    <GlassCard variant="strong" padded={false} className="flex h-full flex-col p-6 sm:p-7">
      <div className={cn("font-mono text-[11px] uppercase tracking-[0.14em]", ok ? "text-orza-success" : "text-orza-error")}>
        {ok ? "Recommended" : "Not for"}
      </div>
      <h3 className="mt-2 font-editorial text-[22px] font-semibold leading-tight tracking-[-0.01em] text-orza-strong">
        {ok ? (
          "Use ÖRZA for"
        ) : (
          <>
            Do <span className="text-orza-error">NOT</span> use ÖRZA for
          </>
        )}
      </h3>
      <ul className="mt-5 flex flex-col gap-2.5">
        {items.map((it) => (
          <li
            key={it}
            className={cn(
              "flex items-center gap-3 rounded-orza-sm border px-3.5 py-3 text-[15px] font-medium text-orza-strong",
              ok ? "border-[rgba(18,122,86,0.18)] bg-[#EAF7F1]/70" : "border-[rgba(176,44,44,0.16)] bg-[#FDECEC]/70"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                ok ? "bg-orza-success text-white" : "bg-orza-error text-white"
              )}
            >
              <Icon size={13} strokeWidth={2.25} />
            </span>
            {it}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}

export default function TrustPage() {
  return (
    <>
      <PageHero
        eyebrow="Trust & Safety"
        icon={<Shield size={12} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />}
        title={
          <>
            Your health. Your <Accent>privacy</Accent>. Your choice.
          </>
        }
        lead="Built with medical boundaries, data security, and transparent practices at the core."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/login?mode=signup" size="lg" className="px-7">
            Get Started <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
          </ButtonLink>
          <ButtonLink href="#privacy-security" variant="secondary" size="lg">
            Privacy &amp; Data Security
          </ButtonLink>
        </div>
      </PageHero>

      {/* Trust pillars */}
      <Section tone="raised" aria-label="Trust pillars">
        <ul className="grid gap-5 md:grid-cols-2 lg:gap-6">
          {PILLARS.map((p, i) => {
            const tone = TONES[p.tone];
            const Icon = p.icon;
            return (
              <Reveal as="li" key={p.title} delay={0.06 * i} className="h-full">
                <GlassCard variant="strong" hover padded={false} className="relative flex h-full flex-col overflow-hidden p-6 sm:p-8">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full"
                    style={{ background: `radial-gradient(circle, ${tone.glow} 0%, rgba(255,255,255,0) 70%)` }}
                  />
                  <div className="relative flex items-center justify-between gap-3">
                    <span className={cn("inline-flex h-8 items-center gap-2 rounded-full border px-3", tone.pill)}>
                      <Icon size={13} strokeWidth={1.75} aria-hidden />
                      <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{p.label}</span>
                    </span>
                    <span aria-hidden className="font-mono text-[12px] tabular-nums text-orza-subtle">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h2 className="relative mt-6 font-editorial text-[24px] font-semibold leading-tight tracking-[-0.015em] text-orza-strong sm:text-[27px]">
                    {p.title}
                  </h2>
                  <p className="relative mt-3 max-w-md text-[15px] leading-relaxed text-orza-muted">{p.desc}</p>
                </GlassCard>
              </Reveal>
            );
          })}
        </ul>
      </Section>

      {/* Medical disclaimer */}
      <Section tone="deep" id="medical-disclaimer">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start lg:gap-14">
          <Reveal>
            <div className="flex items-center gap-2">
              <TriangleAlert size={13} strokeWidth={1.75} className="text-orza-warning" aria-hidden />
              <Eyebrow>Medical boundaries</Eyebrow>
            </div>
            <Heading className="mt-3">Important Medical Disclaimer</Heading>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-orza-muted sm:text-[17px]">
              <p>
                <strong className="font-semibold text-orza-strong">
                  ÖRZA is a wellness guidance platform, not a medical diagnostic tool.
                </strong>{" "}
                We do not diagnose diseases, prescribe medication, or replace professional healthcare.
              </p>
              <p>
                All health insights are for informational and wellness support purposes only. If you have medical concerns, are
                taking medications, or have a diagnosed condition, please consult your doctor before making dietary or lifestyle
                changes.
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            <Reveal delay={0.06} className="h-full">
              <BoundaryCard kind="do" items={USE_FOR} />
            </Reveal>
            <Reveal delay={0.12} className="h-full">
              <BoundaryCard kind="dont" items={DONT_USE_FOR} />
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Privacy & data security */}
      <Section tone="canvas" id="privacy-security">
        <SectionHeader eyebrow="Privacy" title="Privacy & Data Security" align="left" />
        <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-[1fr_1.1fr] lg:gap-6">
          <div className="flex flex-col gap-5 lg:gap-6">
            <Reveal className="flex-1">
              <DetailCard icon={Lock} label="Storage & control" title="Your Data" items={YOUR_DATA} />
            </Reveal>
            <Reveal delay={0.08} className="flex-1">
              <DetailCard icon={FileText} label="Model improvement" title="AI Training" items={AI_TRAINING} />
            </Reveal>
          </div>
          <Reveal delay={0.04} className="h-full">
            <SharingPreview />
          </Reveal>
        </div>
      </Section>

      {/* Compliance & contact */}
      <Section tone="raised" id="compliance">
        <Reveal>
          <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-7 sm:p-10 lg:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-24 h-[440px] w-[440px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,180,84,0.30) 0%, rgba(255,122,106,0.14) 34%, rgba(255,95,162,0.08) 52%, rgba(0,0,0,0) 70%)",
                filter: "blur(10px)",
              }}
            />
            <div className="relative grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-14">
              <div>
                <Eyebrow>Standards</Eyebrow>
                <h2 className="mt-3 font-editorial text-[32px] font-semibold leading-[1.08] tracking-[-0.02em] text-orza-strong sm:text-[42px]">
                  Compliance &amp; Standards
                </h2>
                <ul className="mt-6 flex flex-wrap gap-2.5" aria-label="Compliance and standards">
                  {STANDARDS.map(({ icon: Icon, label }) => (
                    <li
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/70 px-3.5 py-2 text-[14px] font-medium text-orza-strong"
                    >
                      <Icon size={15} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />
                      {label}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/privacy" size="lg" className="px-7">
                    Privacy Policy <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
                  </ButtonLink>
                  <ButtonLink href="/terms" variant="secondary" size="lg">
                    Terms of Service
                  </ButtonLink>
                </div>
              </div>

              <div className="rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/70 p-6 backdrop-blur-orza sm:p-7">
                <IconTile tone="energy">
                  <Mail size={18} strokeWidth={1.75} aria-hidden />
                </IconTile>
                <h3 className="mt-4 font-editorial text-[22px] font-semibold leading-tight tracking-[-0.01em] text-orza-strong">
                  Questions about privacy?
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-orza-muted">
                  Contact:{" "}
                  <a
                    href={`mailto:${SITE.supportEmail}`}
                    className="break-all font-medium text-orza-cyan-600 underline-offset-4 hover:underline"
                  >
                    {SITE.supportEmail}
                  </a>
                </p>
                <a
                  href={`mailto:${SITE.supportEmail}?subject=${encodeURIComponent("Privacy question")}`}
                  className={buttonVariants({ variant: "secondary", size: "md", className: "mt-5 w-full" })}
                >
                  <Mail size={15} strokeWidth={1.75} aria-hidden /> Email us
                </a>
              </div>
            </div>
          </GlassCard>
        </Reveal>
      </Section>
    </>
  );
}
