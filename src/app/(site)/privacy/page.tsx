import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Ban, Download, Eye, Lock, ShieldCheck } from "lucide-react";
import { LegalPage, type LegalHighlight, type LegalSection } from "@/components/pages/legal/LegalPage";
import { PRIVACY_UPDATED } from "@/components/pages/legal/updated";
import { B, InlineLink, LegalCallout, LegalH3, LegalLi, LegalList, LegalP, SupportEmail } from "@/components/pages/legal/prose";
import { Accent } from "@/components/pages/PageHero";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How ÖRZA collects, uses and protects your information: encrypted in transit and at rest, never sold, permission-based household sharing, and export or deletion anytime from Settings.",
  path: "/privacy",
  socialTitle: "ÖRZA Privacy Policy",
  socialDescription: "Encrypted, never sold, and always in your control.",
});

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
          protects your information when you use the ÖRZA website, the web app and the ÖRZA app for iPhone and Android (together, the
          &ldquo;Service&rdquo;). ÖRZA is an
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
          <LegalLi title="Medicines and prescriptions:">
            medicines you add — name, strength, dose, timing, schedule, stock and who each one is for — the photos you take of
            them, prescriptions you scan, and a history of the doses you mark as taken, skipped or snoozed.
          </LegalLi>
          <LegalLi title="Reminders and connections:">
            reminders you set up; if you turn them on, your WhatsApp number, the browser push-notification address your device
            gives us, and the address of an external calendar you ask ÖRZA to show; and your quiet hours.
          </LegalLi>
          <LegalLi title="Health data you import or sync:">
            daily totals such as steps, active energy, distance, sleep, heart rate, weight and water — from an Apple Health
            export or CSV file you import, or sent by an app you set up with your personal sync link. Apple Health exports are
            read in your browser, and only the daily totals are uploaded. If you allow it, the ÖRZA phone app also reads your
            daily steps (from Apple Health, Health Connect or your phone&apos;s motion sensor) and, if you connect them, your daily
            sleep, resting heart rate and weight — see <InlineLink href="#phone-app">Phone app: steps and health data</InlineLink>.
          </LegalLi>
          <LegalLi title="Messages to us:">
            if you email us, join our updates list or join a waitlist for a Premium plan, your email address and what you send us.
          </LegalLi>
          <LegalLi title="Reports:">
            if you report an AI answer, a copy of that answer with your reason and note, which the ÖRZA team reviews to make
            ÖRZA safer.
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
          <LegalLi title="To remind you:">
            send the medicine and wellness reminders you set up — as notifications on your devices, WhatsApp messages or entries
            in your calendar — with your medicine&apos;s photo, so it&apos;s easy to recognise.
          </LegalLi>
          <LegalLi title="To communicate with you:">
            about your account, the reminders and weekly reports you&apos;ve opted into, and replies to your questions. You can
            change reminder and report preferences in Settings.
          </LegalLi>
          <LegalLi title="To improve ÖRZA:">
            using information that has been anonymized so it no longer identifies you — unless you opt out (see{" "}
            <InlineLink href="#ai-processing">AI processing</InlineLink>). Steps, and anything read from Apple Health, Health
            Connect or your phone&apos;s motion sensor, are never used for this.
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
          Some features use AI models from OpenAI, our AI model provider — meal photo scans, prescription scans, text and voice
          meal logging, AI chat, recipe generation and rebalancing plans. When you use one of these features, we send the provider
          the content needed for that request (for example, the meal photo or your message, plus relevant context such as your
          targets, your diet preference and — in AI chat — what you&apos;ve logged today, including your step count) and return the
          result to you.
        </LegalP>
        <LegalList>
          <LegalLi title="Only what the request needs.">
            We share the minimum content required for the feature. Your password is never shared.
          </LegalLi>
          <LegalLi title="On our behalf.">Providers process this content to deliver the feature for you.</LegalLi>
          <LegalLi title="You choose.">
            ÖRZA asks before your first AI feature, on the website and in the phone app, and sends nothing to OpenAI until you
            allow it. Your choice is saved to your account, so it applies everywhere you sign in. You can turn AI features off
            any time on the website under <B>Settings → Preferences → AI features</B>, or in the app under{" "}
            <B>Settings → Privacy &amp; data → AI features</B>; AI features then stop until you allow them again, and nothing
            else changes.
          </LegalLi>
          <LegalLi title="Health data only with your permission.">
            Steps and weight from Apple Health, Health Connect or your phone&apos;s motion sensor go to OpenAI only inside AI chat,
            and only after you&apos;ve allowed AI features. Without that permission, ÖRZA leaves them out of AI requests.
          </LegalLi>
          <LegalLi title="Estimates, not facts.">
            AI output can be incomplete or wrong. Nutrition values are estimates — you can review and correct any logged item.
          </LegalLi>
          <LegalLi title="Works without AI too.">
            When AI is unavailable, ÖRZA uses its built-in food database, and non-AI features never use AI credits.
          </LegalLi>
        </LegalList>
        <LegalP>
          As described on our <InlineLink href="/trust">Trust &amp; Safety</InlineLink> page, conversations may help improve
          ÖRZA&apos;s AI only after they are anonymized, and no personal health data is ever sold. You can opt out at any time by
          turning off <B>Help improve ÖRZA&apos;s AI</B> in <B>Settings → Preferences</B>, or by writing to <SupportEmail subject="AI training opt-out" />. Your choice is saved
          to your account and keeps your conversations and logs out of any work to improve ÖRZA&apos;s AI. Opting out
          doesn&apos;t change how AI features work for you. Whatever this setting, your steps and anything ÖRZA reads from Apple
          Health, Health Connect or your phone&apos;s motion sensor are never used to improve ÖRZA&apos;s AI.
        </LegalP>
      </>
    ),
  },
  {
    id: "phone-app",
    title: "Phone app: steps and health data",
    content: (
      <>
        <LegalP>
          The ÖRZA app for iPhone and Android can count your steps for you and bring in a few daily health numbers from your
          phone. It does this only after you turn it on in the app and allow it in your phone&apos;s own permission screen, and you
          can turn it off at any time.
        </LegalP>

        <LegalH3>What the app reads</LegalH3>
        <LegalList>
          <LegalLi title="Steps, if you turn on step counting:">
            each day&apos;s step total. On an iPhone it comes from Apple Health — the steps your iPhone and Apple Watch record, and
            those of other apps that share steps with Apple Health. If Apple Health has no steps for ÖRZA, you can choose to let
            ÖRZA count them with your iPhone&apos;s motion sensor (Motion &amp; Fitness) instead. On Android it comes from Health
            Connect — this phone&apos;s steps and those of any watch or fitness app that shares them there — or from your
            phone&apos;s motion sensor, through the &ldquo;Physical activity&rdquo; permission, counted on the phone by Google Play
            services (or by ÖRZA itself on phones without it). On newer Android phones, allowing ÖRZA to read steps also switches
            on Health Connect&apos;s own step counting; Health Connect keeps those steps on your phone for the apps you allow.
          </LegalLi>
          <LegalLi title="Sleep, resting heart rate and weight, if you connect Apple Health or Health Connect on the app’s Health screen:">
            each day&apos;s values, for up to the last 30 days.
          </LegalLi>
          <LegalLi title="Nothing else from them.">
            The app doesn&apos;t read your location, routes, workouts or medical records, and it never writes or changes anything in
            Apple Health or Health Connect.
          </LegalLi>
        </LegalList>

        <LegalH3>When it reads</LegalH3>
        <LegalList>
          <LegalLi title="Steps:">
            while you use the app and — when your phone allows it — in the background about once an hour, so your step goal,
            reports and the website stay up to date while the app is closed. Each read also checks the last few days, because
            watches and fitness apps often sync late. When you first turn step counting on, ÖRZA can bring in your step totals
            from up to the last 30 days (fewer when they come from the motion sensor). If another ÖRZA account has already turned
            on step counting in this installation of the app, your account only gets steps from the moment you turned it on;
            reinstalling the app, clearing its data or deleting that account makes the app forget the other account.
          </LegalLi>
          <LegalLi title="Sleep, resting heart rate and weight:">
            when you open the app (at most every few hours) or tap <B>Sync now</B> on the Health screen.
          </LegalLi>
        </LegalList>

        <LegalH3>What leaves your phone, and where it&apos;s kept</LegalH3>
        <LegalList>
          <LegalLi title="Daily totals only.">
            Only one number per day for each kind of data — the day&apos;s step total, sleep time, resting heart rate and weight —
            is sent to your ÖRZA account, over an encrypted connection. The individual readings and the times you moved stay on
            your phone, and ÖRZA never collects your location.
          </LegalLi>
          <LegalLi title="In your account:">
            these totals are stored with the rest of your ÖRZA data, protected as described in{" "}
            <InlineLink href="#security">How we protect your information</InlineLink>, and shown to you on Today, the Health
            screen, your reports and the website.
          </LegalLi>
          <LegalLi title="On your phone:">
            the app keeps recent days&apos; step counts in its cache, which isn&apos;t included in iCloud or Android backups, and
            deletes them when you sign out. Motion-sensor step data stays on your phone and is used only to work out these daily
            totals.
          </LegalLi>
        </LegalList>

        <LegalH3>How it&apos;s used — and how it isn&apos;t</LegalH3>
        <LegalList>
          <LegalLi title="To show you your own progress:">
            your steps toward your daily goal, your health trends and your reports, in the app and on the website.
          </LegalLi>
          <LegalLi title="In AI chat, if you’ve allowed AI features:">
            today&apos;s step count and step goal are part of the context ÖRZA&apos;s AI chat sends to our AI model provider to
            answer you, along with your meals, targets and profile (see{" "}
            <InlineLink href="#ai-processing">AI processing</InlineLink>). Sleep and resting heart rate aren&apos;t sent to AI
            providers.
          </LegalLi>
          <LegalLi title="Never sold, never for ads.">
            We don&apos;t sell this data, share it with advertisers or data brokers, or use it for advertising or marketing.
          </LegalLi>
          <LegalLi title="Never used to improve AI.">
            Steps, and anything ÖRZA reads from Apple Health, Health Connect or your phone&apos;s motion sensor, are never used to
            improve ÖRZA&apos;s AI, whatever your setting for <B>Help improve ÖRZA&apos;s AI</B>.
          </LegalLi>
          <LegalLi title="Otherwise shared only as this policy describes:">
            with the service providers that run ÖRZA for us — such as hosting and, for AI chat, the AI model provider — and for
            the reasons in <InlineLink href="#sharing">How information is shared</InlineLink>.
          </LegalLi>
        </LegalList>

        <LegalH3>Turning it off and deleting it</LegalH3>
        <LegalList>
          <LegalLi title="In the app:">
            turn off <B>Count steps automatically</B> (on the Health screen or in Settings → Privacy &amp; data) and ÖRZA stops
            reading steps on that phone; stopping the Apple Health or Health Connect connection on the Health screen stops it
            reading sleep, resting heart rate and weight. You can always type your steps in yourself instead.
          </LegalLi>
          <LegalLi title="On your phone:">
            on an iPhone, Settings → Health → Data Access &amp; Devices → ÖRZA, and Settings → Privacy &amp; Security → Motion
            &amp; Fitness; on Android, Health Connect → App permissions → ÖRZA, and the &ldquo;Physical activity&rdquo; permission
            in your phone&apos;s settings for ÖRZA.
          </LegalLi>
          <LegalLi title="What’s already saved:">
            turning these off doesn&apos;t remove the daily totals already in your account. You can change any day&apos;s steps
            on Today, and deleting your account permanently deletes all of this data with the rest of your account. To have it
            deleted without closing your account, email <SupportEmail subject="Delete my phone health data" />.
          </LegalLi>
        </LegalList>
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
          <LegalLi title="To deliver the reminders you turn on.">
            Push notifications travel through your browser&apos;s notification service, and WhatsApp reminders through
            WhatsApp&apos;s business messaging service, to the number you give us. They carry only what the reminder needs: the
            reminder or medicine name, the dose and, for medicines, its photo — shared through a link that expires within a day.
          </LegalLi>
          <LegalLi title="With calendars you connect.">
            Your private calendar feed lists your upcoming doses and reminders for whichever calendar app you add it to. Anyone
            with the feed link can read it, so keep it private — you can replace or turn off the link at any time.
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
          The web app also remembers a few conveniences in your browser&apos;s local storage, such as the language you last
          picked for voice input, your calendar view and which alarms you&apos;ve already dismissed or snoozed. That stays on your device.
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
          <LegalLi title="Sessions:">
            on the website, sign-in sessions use signed cookies that page scripts can&apos;t access; the phone app keeps its sign-in
            in your phone&apos;s secure storage.
          </LegalLi>
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
          associated data — meals, scans, conversations, goals, plans, recipes, medicines and their photos, prescriptions, dose
          history, reminders, notification devices, step counts and other health data (imported, synced or read by the phone app)
          and credit history — are permanently deleted. We may
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
          <LegalLi title="Communications:">
            turn reminders and weekly reports on or off in Settings, and switch push, WhatsApp or calendar reminders on or off on
            the Reminders page.
          </LegalLi>
          <LegalLi title="Connections:">
            revoke your health sync link or calendar feed link at any time, and remove your WhatsApp number or external calendar.
            In the phone app, turn off automatic step counting or disconnect Apple Health or Health Connect at any time (see{" "}
            <InlineLink href="#phone-app">Phone app: steps and health data</InlineLink>).
          </LegalLi>
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
      lead="What ÖRZA collects, why, and the controls you have over it — encrypted, never sold, and shared only as this policy describes."
      highlights={HIGHLIGHTS}
      sections={SECTIONS}
      updated={PRIVACY_UPDATED}
      related={[
        { label: "Terms of Service", href: "/terms" },
        { label: "Trust & Safety", href: "/trust" },
      ]}
      contactSubject="Privacy question"
    />
  );
}
