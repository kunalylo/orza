import type { Metadata } from "next";
import { Check, Coins, FileText, Stethoscope, Trash2, X, XCircle } from "lucide-react";
import { INITIAL_CREDITS } from "@/lib/credits";
import { LegalPage, type LegalHighlight, type LegalSection } from "@/components/pages/legal/LegalPage";
import { B, InlineLink, LegalCallout, LegalLi, LegalList, LegalP, SupportEmail } from "@/components/pages/legal/prose";
import { Accent } from "@/components/pages/PageHero";
import { creditActionRows, creditsLabel } from "@/components/pages/pricing/credit-actions";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using ÖRZA: wellness guidance (not medical advice), your account, AI features and credits, plans and payments, household modes, and your rights.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "ÖRZA Terms of Service",
    description: "Plain-language terms for using ÖRZA.",
  },
};

const HIGHLIGHTS: LegalHighlight[] = [
  { icon: Stethoscope, title: "Not medical advice", body: "ÖRZA offers wellness guidance. Always consult your doctor for medical concerns." },
  { icon: Coins, title: `${INITIAL_CREDITS} free AI credits`, body: "Every new account starts with free credits for AI features." },
  { icon: XCircle, title: "No surprise charges", body: "ÖRZA doesn't take payments yet. Paid plans will always be your choice to start." },
  { icon: Trash2, title: "Leave anytime", body: "Delete your account from Settings and your data is permanently deleted." },
];

function CreditTable() {
  const rows = creditActionRows();
  return (
    <ul
      aria-label="AI credit cost per action"
      className="grid overflow-hidden rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/60 sm:grid-cols-2"
    >
      {rows.map(({ key, label, cost, icon: Icon }) => (
        <li
          key={key}
          className="flex items-center gap-3 border-b border-[rgba(20,20,20,0.06)] px-4 py-3 last:border-b-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-b-0 sm:odd:border-r"
        >
          <Icon size={16} strokeWidth={1.75} className="shrink-0 text-orza-muted" aria-hidden />
          <span className="flex-1 text-[14px] text-orza-strong">{label}</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-orza-warning">{creditsLabel(cost)}</span>
        </li>
      ))}
    </ul>
  );
}

function UseList({ kind, items }: { kind: "do" | "dont"; items: string[] }) {
  const ok = kind === "do";
  const Icon = ok ? Check : X;
  return (
    <p className="flex items-start gap-2.5">
      <span
        aria-hidden
        className={`mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${ok ? "bg-orza-success" : "bg-orza-error"}`}
      >
        <Icon size={12} strokeWidth={2.5} />
      </span>
      <span>
        <B>{ok ? "Use ÖRZA for:" : "Do NOT use ÖRZA for:"}</B> {items.join(", ")}
      </span>
    </p>
  );
}

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement to these terms",
    content: (
      <>
        <LegalP>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the ÖRZA website, web app and related services
          (together, the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms and to our{" "}
          <InlineLink href="/privacy">Privacy Policy</InlineLink>. If you don&apos;t agree, please don&apos;t use the Service.
        </LegalP>
        <LegalP>
          We&apos;ve kept these Terms as plain as we can. Where we say &ldquo;ÖRZA&rdquo;, &ldquo;we&rdquo; or &ldquo;us&rdquo;, we
          mean the team that operates the Service; &ldquo;you&rdquo; means the person using it.
        </LegalP>
      </>
    ),
  },
  {
    id: "the-service",
    title: "What ÖRZA is",
    content: (
      <LegalP>
        ÖRZA is an AI-powered wellness platform. You can log meals by photo, text or voice in English, Hindi or Hinglish, see
        nutrition insights, set goals and calorie targets, generate recipes, get compassionate rebalancing plans after special
        meals, view reports, and coordinate health in Household modes. Features can vary by plan and platform, and some may be
        marked as coming soon.
      </LegalP>
    ),
  },
  {
    id: "medical",
    title: "Wellness guidance, not medical advice",
    content: (
      <>
        <LegalCallout tone="warning" title="Important Medical Disclaimer">
          <p>
            ÖRZA is a wellness guidance platform, not a medical diagnostic tool. We do not diagnose diseases, prescribe medication,
            or replace professional healthcare.
          </p>
          <p>
            All health insights are for informational and wellness support purposes only. If you have medical concerns, are taking
            medications, or have a diagnosed condition, please consult your doctor before making dietary or lifestyle changes.
          </p>
          <div className="space-y-2 pt-1">
            <UseList kind="do" items={["Nutrition tracking", "meal planning", "wellness insights"]} />
            <UseList kind="dont" items={["Medical diagnosis", "treatment decisions", "emergency health situations"]} />
          </div>
        </LegalCallout>
        <LegalP>
          If you think you may be having a medical emergency, call your local emergency number (112 in India) or go to the nearest
          hospital right away. Nutrition values, calorie targets and AI suggestions are estimates; use your own judgement and the
          advice of qualified professionals.
        </LegalP>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    content: (
      <LegalList>
        <LegalLi title="Eligibility:">
          you must be at least 18 years old to create an account. Household modes let an adult manage profiles for dependents.
        </LegalLi>
        <LegalLi title="Accurate information:">
          give accurate details, especially the profile information used to calculate your targets, and keep them up to date.
        </LegalLi>
        <LegalLi title="Security:">
          keep your password confidential. You are responsible for activity on your account; tell us promptly at{" "}
          <SupportEmail subject="Account security" /> if you suspect unauthorised use.
        </LegalLi>
        <LegalLi title="One person per account:">
          accounts are personal. Use Household modes, not shared logins, to support family members.
        </LegalLi>
      </LegalList>
    ),
  },
  {
    id: "ai-credits",
    title: "AI features and credits",
    content: (
      <>
        <LegalP>
          In the ÖRZA web app, AI features are measured in credits. <B>Every new account receives {INITIAL_CREDITS} free AI
          credits.</B> Each AI action uses the following number of credits:
        </LegalP>
        <CreditTable />
        <LegalList>
          <LegalLi title="Free without AI.">
            Manual logging is always free, and features that don&apos;t use AI never cost credits. When AI is unavailable, ÖRZA
            falls back to its built-in food database at no cost.
          </LegalLi>
          <LegalLi title="Automatic refunds.">If an AI request doesn&apos;t go through, its credits are refunded automatically.</LegalLi>
          <LegalLi title="No cash value.">
            Credits can&apos;t be exchanged for money or transferred to another account, and we may correct balances affected by
            errors or misuse.
          </LegalLi>
          <LegalLi title="Check AI output.">
            AI can be incomplete or wrong. Review results before relying on them — you can edit or delete any logged item.
          </LegalLi>
        </LegalList>
      </>
    ),
  },
  {
    id: "plans-billing",
    title: "Plans and payments",
    content: (
      <>
        <LegalList>
          <LegalLi title="Free Forever:">
            manual tracking, a basic dashboard and goal setting stay free, and every new account gets {INITIAL_CREDITS} AI
            credits. See <InlineLink href="/pricing">Pricing</InlineLink> for what each plan includes.
          </LegalLi>
          <LegalLi title="Premium plans are launching soon:">
            the Individual, Couple, Caregiver and Family plans and AI top-up packs on our Pricing page are a preview. They
            can&apos;t be bought yet, and ÖRZA doesn&apos;t take payments or ask for card details today. Joining a waitlist
            doesn&apos;t commit you to anything.
          </LegalLi>
          <LegalLi title="Before you’re ever charged:">
            when a paid plan launches, its price, billing period, any trial, renewal and cancellation terms will be shown to you
            before you buy, and you&apos;ll only be charged for a plan you choose to start. We&apos;ll update these Terms at the
            same time.
          </LegalLi>
          <LegalLi title="More credits in the meantime:">
            if you run low, you can ask for more from the Credits page in the app. Credits we add follow the same rules as the
            rest of your credits.
          </LegalLi>
        </LegalList>
      </>
    ),
  },
  {
    id: "household",
    title: "Household modes",
    content: (
      <>
        <LegalP>
          Couple, Caregiver and Family modes let people coordinate meals and wellness together. Sharing is permission-based only:
          each profile remains private unless explicitly shared, you control what is shared, and you can revoke access anytime.
        </LegalP>
        <LegalP>
          If you log information for someone else — such as a partner, a child or an elderly parent — you confirm that you have
          their consent or the authority to do so, and you are responsible for the information you add.
        </LegalP>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    content: (
      <>
        <LegalP>
          You own what you put into ÖRZA — your meal logs, photos, messages and notes. You give us a limited licence to store,
          process and display that content only as needed to provide the Service to you, including sending it to AI model
          providers when you use an AI feature, as described in our <InlineLink href="/privacy#ai-processing">Privacy Policy</InlineLink>.
        </LegalP>
        <LegalP>
          Only upload content you have the right to share. If you send us feedback or suggestions, we may use them to improve ÖRZA
          without any obligation to you.
        </LegalP>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <LegalP>To keep ÖRZA safe and fair for everyone, you agree not to:</LegalP>
        <LegalList>
          <LegalLi>use the Service for anything unlawful, harmful or fraudulent;</LegalLi>
          <LegalLi>access, or try to access, another person&apos;s account or data without their permission;</LegalLi>
          <LegalLi>probe, scan or test the Service&apos;s security, or interfere with its operation;</LegalLi>
          <LegalLi>scrape, copy, reverse engineer or resell the Service, or overload it with automated requests;</LegalLi>
          <LegalLi>misuse AI features or credits, or try to get around usage limits;</LegalLi>
          <LegalLi>upload malware, or content that is illegal, abusive or infringes someone else&apos;s rights;</LegalLi>
          <LegalLi>present ÖRZA&apos;s wellness guidance to others as medical advice.</LegalLi>
        </LegalList>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "ÖRZA’s intellectual property",
    content: (
      <LegalP>
        The Service — including its software, design, food database, text and the ÖRZA name and logo — belongs to ÖRZA or its
        licensors. We give you a personal, non-exclusive, non-transferable licence to use the Service in line with these Terms.
        Nothing here gives you any other rights in it.
      </LegalP>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services",
    content: (
      <LegalP>
        ÖRZA relies on third-party providers such as cloud hosting, AI model providers and, where available, connected health
        platforms like Apple Health and Google Fit or payment providers. Your use of a third-party platform you connect may also
        be subject to that provider&apos;s own terms. We aren&apos;t responsible for services we don&apos;t control.
      </LegalP>
    ),
  },
  {
    id: "changes-to-service",
    title: "Changes to the Service",
    content: (
      <LegalP>
        ÖRZA is evolving. We may add, change or remove features, and the Service may occasionally be unavailable for maintenance
        or reasons outside our control. If a change materially reduces what you&apos;ve paid for, we will let you know in advance
        where we reasonably can.
      </LegalP>
    ),
  },
  {
    id: "termination",
    title: "Suspension and termination",
    content: (
      <>
        <LegalP>
          You can stop using ÖRZA at any time. Deleting your account from Settings permanently deletes your data and can&apos;t be
          undone — you can export a copy first.
        </LegalP>
        <LegalP>
          We may suspend or close an account that seriously or repeatedly breaks these Terms, or where required by law. Where
          reasonable, we will tell you why and give you a chance to export your data.
        </LegalP>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    content: (
      <LegalP>
        We work hard to make ÖRZA accurate and reliable, but the Service is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;. To the extent permitted by law, we don&apos;t promise that nutrition estimates, AI output or targets
        will be accurate, complete or suitable for your specific health needs, or that the Service will be uninterrupted or
        error-free.
      </LegalP>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    content: (
      <LegalP>
        To the maximum extent permitted by law, ÖRZA is not liable for indirect, incidental, special or consequential losses, or
        for decisions you make based on wellness guidance from the Service. Our total liability for any claim relating to the
        Service is limited to the amount you paid us for the Service in the 12 months before the claim arose. Nothing in these
        Terms limits liability that cannot be limited by law.
      </LegalP>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law and disputes",
    content: (
      <LegalP>
        These Terms are governed by the laws of India. If something goes wrong, please contact us first at{" "}
        <SupportEmail subject="Dispute" /> — most concerns can be resolved quickly and informally. Any dispute that can&apos;t be
        resolved this way will be subject to the jurisdiction of the competent courts in India.
      </LegalP>
    ),
  },
  {
    id: "changes-to-terms",
    title: "Changes to these Terms",
    content: (
      <LegalP>
        We may update these Terms as ÖRZA evolves. The date at the top of this page shows when they last changed. If we make
        material changes, we will tell you in the app or by email before they take effect; continuing to use the Service after
        that means you accept the updated Terms.
      </LegalP>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    content: (
      <LegalP>
        Questions about these Terms? Email <SupportEmail subject="Terms of Service question" /> and we&apos;ll be glad to help.
      </LegalP>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      docName="terms of service"
      eyebrow="Legal"
      icon={<FileText size={12} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />}
      title={
        <>
          Terms of <Accent>Service</Accent>
        </>
      }
      lead="In plain language: what you can expect from ÖRZA, what we ask of you, and how plans, credits and your data work."
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
      related={[
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Trust & Safety", href: "/trust" },
      ]}
      contactSubject="Terms of Service question"
    />
  );
}
