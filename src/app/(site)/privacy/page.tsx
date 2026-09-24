import type { Metadata } from "next";
import { Ban, Download, Eye, Lock, ShieldCheck } from "lucide-react";
import { LegalPage, type LegalHighlight, type LegalSection } from "@/components/pages/legal/LegalPage";
import { B, InlineLink, LegalCallout, LegalH3, LegalLi, LegalList, LegalP, SupportEmail } from "@/components/pages/legal/prose";
import { Accent } from "@/components/pages/PageHero";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How ÖRZA collects, uses and protects your information: encrypted in transit and at rest, never sold, permission-based household sharing, and export or deletion anytime from Settings.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "ÖRZA Privacy Policy",
    description: "Encrypted, never sold, and always in your control.",
  },
};

const HIGHLIGHTS: LegalHighlight[] = [
  { icon: Lock, title: "Encrypted", body: "Your data is encrypted in transit and at rest." },
  { icon: Ban, title: "Never sold", body: "We never sell your personal or health data to third parties." },
  { icon: Eye, title: "You control sharing", body: "Household sharing only happens with your explicit permission." },
  { icon: Download, title: "Export or delete", body: "Download all your data or delete your account anytime in Settings." },
];

const SECTIONS: LegalSection[] = [
  {
    id: "overview",
    title: "Overview",
    content: (
      <>
        <LegalP>
          This Privacy Policy explains how ÖRZA (&ldquo;ÖRZA&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) collects, uses, shares and
          protects your information when you use the ÖRZA website and web app (together, the &ldquo;Service&rdquo;). ÖRZA is an
          AI-powered wellness platform: you log meals by photo, text or voice, and ÖRZA turns that into nutrition insights, goals,
          recipes, rebalancing plans and reports.
        </LegalP>
        <LegalP>
          Health and lifestyle information is personal. Our approach is simple: collect only what the Service needs, protect it,
          never sell it, and keep you in control of it. By using the Service you acknowledge the practices described here.
        </LegalP>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    content: (
      <>
        <LegalH3>Information you give us</LegalH3>
        <LegalList>
          <LegalLi title="Account details:">
            your name, email address and password. Passwords are stored only as a salted, one-way hash — never in readable form.
          </LegalLi>
          <LegalLi title="Profile and goals:">
            details you share during onboarding or in Settings, such as your goal, age, sex, height, current and target weight,
            activity level, diet preference, allergies, region, preferred language, household mode and optional lifestyle notes.
          </LegalLi>
          <LegalLi title="Wellness logs:">
            meals you log — including meal photos you choose to scan and the text or voice descriptions you give — along with water,
            steps and weight entries, goals, rebalancing plans, recipes and reports.
          </LegalLi>
          <LegalLi title="Conversations:">messages you send to ÖRZA&apos;s AI chat and the replies you receive.</LegalLi>
          <LegalLi title="What ÖRZA remembers:">
            short facts ÖRZA learns from your conversations to personalise its guidance (for example, a food you avoid). You can
            view, edit or remove them in Settings.
          </LegalLi>
          <LegalLi title="Connected health data (where available):">
            if you connect a health platform such as Apple Health or Google Fit, the data you authorise, such as steps, sleep and
            workouts.
          </LegalLi>
          <LegalLi title="Messages to us:">
            if you email us, join our updates list or join a waitlist for a Premium plan, your email address and what you send us.
          </LegalLi>
        </LegalList>

        <LegalH3>Information created as you use the Service</LegalH3>
        <LegalList>
          <LegalLi title="AI credits:">your credit balance and a history of credit transactions.</LegalLi>
          <LegalLi title="Technical information:">
            what&apos;s needed to run and secure the Service, such as your sign-in session, IP address, browser type and error logs.
          </LegalLi>
        </LegalList>

        <LegalP>
          We don&apos;t use advertising trackers or third-party analytics cookies, and we don&apos;t ask for more information than a
          feature needs.
        </LegalP>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use your information",
    content: (
      <>
        <LegalList>
          <LegalLi title="To provide the Service:">
            log and total your meals, calculate personalised calorie and macro targets, and show your dashboard, streaks, plans
            and reports.
          </LegalLi>
          <LegalLi title="To personalise guidance:">
            tailor suggestions to your goals, food preferences, allergies, region and language.
          </LegalLi>
          <LegalLi title="To run AI features you choose to use:">
            see <InlineLink href="#ai-processing">AI processing</InlineLink> below.
          </LegalLi>
          <LegalLi title="To keep ÖRZA safe:">protect accounts, prevent abuse and fix problems.</LegalLi>
          <LegalLi title="To communicate with you:">
            about your account, the reminders and weekly reports you&apos;ve opted into, and replies to your questions. You can
            change reminder and report preferences in Settings.
          </LegalLi>
          <LegalLi title="To improve ÖRZA:">
            using information that has been anonymized so it no longer identifies you — unless you opt out (see{" "}
            <InlineLink href="#ai-processing">AI processing</InlineLink>).
          </LegalLi>
        </LegalList>
        <LegalP>
          <B>We never sell your personal information</B>, and we don&apos;t use your health data for advertising.
        </LegalP>
      </>
    ),
  },
  {
    id: "ai-processing",
    title: "AI processing",
    content: (
      <>
        <LegalP>
          Some features use AI models operated by third-party model providers — meal photo scans, text and voice meal logging, AI
          chat, recipe generation, rebalancing plans and report insights. When you use one of these features, we send the provider
          the content needed for that request (for example, the meal photo or your message, plus relevant context such as your
          targets or diet preference) and return the result to you.
        </LegalP>
        <LegalList>
          <LegalLi title="Only what the request needs.">
            We share the minimum content required for the feature. Your password is never shared.
          </LegalLi>
          <LegalLi title="On our behalf.">Providers process this content to deliver the feature for you.</LegalLi>
          <LegalLi title="Estimates, not facts.">
            AI output can be incomplete or wrong. Nutrition values are estimates — you can review and correct any logged item.
          </LegalLi>
          <LegalLi title="Works without AI too.">
            When AI is unavailable, ÖRZA uses its built-in food database, and non-AI features never use AI credits.
          </LegalLi>
        </LegalList>
        <LegalP>
          As described on our <InlineLink href="/trust">Trust &amp; Safety</InlineLink> page, conversations may help improve
          ÖRZA&apos;s AI only after they are anonymized, and no personal health data is ever sold. You can opt out at any time in{" "}
          <B>Settings → Preferences</B>, or by writing to <SupportEmail subject="AI training opt-out" />. Your choice is saved
          to your account and keeps your conversations and logs out of any work to improve ÖRZA&apos;s AI. Opting out
          doesn&apos;t change how AI features work for you.
        </LegalP>
      </>
    ),
  },
  {
    id: "sharing",
    title: "How information is shared",
    content: (
      <>
        <LegalP>We never sell your personal information to third parties. We share it only in these situations:</LegalP>
        <LegalList>
          <LegalLi title="With people you choose.">
            Household modes (Couple, Caregiver and Family) share information only after you explicitly grant permission. Each
            profile stays private unless shared, you control what is shared, and you can revoke access at any time.
          </LegalLi>
          <LegalLi title="With service providers">
            who help us run ÖRZA — such as cloud hosting and database providers, AI model providers and email delivery — who
            process information on our behalf and only for that purpose.
          </LegalLi>
          <LegalLi title="For legal reasons:">
            when required by law, or when needed to protect the safety, rights or property of our users, the public or ÖRZA.
          </LegalLi>
          <LegalLi title="In a business change:">
            if ÖRZA is involved in a merger, acquisition or sale of assets, your information may transfer under this policy. We
            will tell you before it becomes subject to a different privacy policy.
          </LegalLi>
        </LegalList>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    content: (
      <>
        <LegalP>
          ÖRZA uses two essential cookies. Both are set when you sign in and removed when you sign out, or after 30 days:
        </LegalP>
        <LegalList>
          <LegalLi title="Session cookie:">
            keeps you signed in. It holds a signed sign-in token and can&apos;t be read by scripts on the page.
          </LegalLi>
          <LegalLi title="Signed-in hint:">
            contains only the value &ldquo;1&rdquo;, so our public pages can show &ldquo;Open ÖRZA&rdquo; instead of &ldquo;Sign
            In&rdquo;. Scripts on the page can read it, but it holds no personal information and is never used to sign you in or
            to identify you.
          </LegalLi>
        </LegalList>
        <LegalP>
          The web app also remembers a few conveniences, such as the language you last picked for voice input, in your
          browser&apos;s local storage. That stays on your device.
        </LegalP>
        <LegalP>
          We don&apos;t use advertising, tracking or third-party analytics cookies. Because both cookies exist only to support
          signing in, there are no optional cookies to manage.
        </LegalP>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect your information",
    content: (
      <>
        <LegalList>
          <LegalLi title="Encryption:">your data is encrypted in transit (TLS) and at rest.</LegalLi>
          <LegalLi title="Passwords:">stored only as salted, one-way hashes.</LegalLi>
          <LegalLi title="Sessions:">sign-in sessions use signed cookies that page scripts can&apos;t access.</LegalLi>
          <LegalLi title="Access control:">
            every request is checked against your account, so your data is available only to you and the people you choose to
            share it with.
          </LegalLi>
        </LegalList>
        <LegalP>
          No system is perfectly secure. If a security incident affects your personal information, we will notify you and the
          relevant authorities as required by law.
        </LegalP>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep information",
    content: (
      <>
        <LegalP>
          We keep your information for as long as your account is active. When you delete your account, your profile and all
          associated data — meals, scans, conversations, goals, plans, recipes and credit history — are permanently deleted. We may
          keep limited records where the law requires it (for example, billing records for paid plans).
        </LegalP>
        <LegalP>
          If you joined our updates list or a plan waitlist, we keep your email address until you ask us to remove it.
        </LegalP>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights and choices",
    content: (
      <>
        <LegalList>
          <LegalLi title="Access and export:">download a copy of all your data from Settings at any time.</LegalLi>
          <LegalLi title="Correction:">
            update your profile, targets and preferences in Settings, and edit or remove anything ÖRZA remembers about you.
          </LegalLi>
          <LegalLi title="Deletion:">
            delete your account from Settings. This permanently deletes your data and can&apos;t be undone.
          </LegalLi>
          <LegalLi title="Sharing:">grant or revoke household sharing permissions at any time.</LegalLi>
          <LegalLi title="Communications:">turn reminders and weekly reports on or off in Settings.</LegalLi>
          <LegalLi title="AI improvement:">
            opt out of your anonymized data being used to improve ÖRZA&apos;s AI in Settings → Preferences, or by email.
          </LegalLi>
        </LegalList>
        <LegalP>
          You may have further rights under applicable data protection law, including India&apos;s Digital Personal Data
          Protection Act, 2023 — such as the right to withdraw consent, to have a grievance addressed, or to nominate someone to
          exercise your rights. To make a request, email <SupportEmail subject="Privacy request" />. We may need to verify your
          identity before acting on it.
        </LegalP>
      </>
    ),
  },
  {
    id: "health-information",
    title: "Health information",
    content: (
      <>
        <LegalP>
          We treat health and wellness information with extra care and use it only to provide and personalise the Service for
          you.
        </LegalP>
        <LegalCallout tone="warning" title="Wellness guidance, not medical advice">
          <p>
            ÖRZA is a wellness guidance platform, not a medical diagnostic tool. We do not diagnose diseases, prescribe medication,
            or replace professional healthcare. If you have medical concerns, please consult your doctor. See our{" "}
            <InlineLink href="/terms#medical">Terms of Service</InlineLink> for details.
          </p>
        </LegalCallout>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    content: (
      <LegalP>
        ÖRZA accounts are for people aged 18 and over. In Household modes, a parent, guardian or caregiver may log information
        for a child or dependent; that adult is responsible for having the authority and consent to do so. If you believe a child
        has created an account, contact us and we will delete it.
      </LegalP>
    ),
  },
  {
    id: "where-processed",
    title: "Where information is processed",
    content: (
      <LegalP>
        ÖRZA is built for India. Some of our service providers, including AI model providers and cloud infrastructure, may
        process information in other countries. When that happens, we take steps to keep it protected as described in this policy
        and as required by applicable law.
      </LegalP>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <LegalP>
        We will update this policy as ÖRZA evolves. The date at the top of this page shows when it last changed. If we make
        material changes, we will tell you in the app or by email before they take effect.
      </LegalP>
    ),
  },
  {
    id: "contact",
    title: "Contact us",
    content: (
      <LegalP>
        Questions, requests or concerns about privacy? Email <SupportEmail subject="Privacy question" />. We&apos;re happy to
        help.
      </LegalP>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      docName="privacy policy"
      eyebrow="Legal"
      icon={<ShieldCheck size={12} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />}
      title={
        <>
          Privacy <Accent>Policy</Accent>
        </>
      }
      lead="What ÖRZA collects, why, and the controls you have over it — encrypted, never sold, and shared only with your permission."
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
      related={[
        { label: "Terms of Service", href: "/terms" },
        { label: "Trust & Safety", href: "/trust" },
      ]}
      contactSubject="Privacy question"
    />
  );
}
