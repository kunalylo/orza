import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Trash2 } from "lucide-react";
import { LegalPage, type LegalSection } from "@/components/pages/legal/LegalPage";
import { PRIVACY_CONTROLLER_NAME } from "@/components/pages/legal/responsible";
import { DELETE_ACCOUNT_UPDATED } from "@/components/pages/legal/updated";
import { B, InlineLink, LegalP, SupportEmail } from "@/components/pages/legal/prose";
import { Accent } from "@/components/pages/PageHero";

/**
 * How to delete an ÖRZA account (the page Google Play's Data safety form and the privacy policy's "Your rights" ›
 * Deletion link to). Copy: the user-approved draft in the mobile repo's docs/store/google-play.md §4. The paths it names
 * are the phone app's More › Settings › Privacy & data › Delete account (mobile repo: src/app/(app)/settings.tsx →
 * account/data.tsx) and the website's Settings › Privacy & data (PrivacySection); what it lists as deleted is what
 * DELETE /api/account removes. Change them together.
 */
export const metadata: Metadata = pageMetadata({
  title: "Delete your account",
  description:
    "How to delete your ÖRZA account and all of its data: in the ÖRZA app, on the website, or by email if you can't sign in — and what is deleted.",
  path: "/delete-account",
  socialTitle: "Delete your ÖRZA account",
  socialDescription: "Every way to delete your ÖRZA account and its data.",
});

const SECTIONS: LegalSection[] = [
  {
    id: "in-the-app",
    title: "In the ÖRZA app",
    content: (
      <LegalP>
        On Android or iPhone, open <B>More › Settings › Privacy &amp; data › Delete account</B>. Type <B>DELETE</B> and tap{" "}
        <B>Delete forever</B>.
      </LegalP>
    ),
  },
  {
    id: "on-the-website",
    title: "On the website",
    content: (
      <LegalP>
        Sign in, open <InlineLink href="/dashboard/settings#privacy">Settings › Privacy &amp; data</InlineLink>, choose{" "}
        <B>Delete account…</B> and type <B>DELETE</B>.
      </LegalP>
    ),
  },
  {
    id: "cant-sign-in",
    title: "Can’t sign in?",
    content: (
      <LegalP>
        Email <SupportEmail subject="Delete my account" /> from your account&apos;s email address with the subject{" "}
        &ldquo;Delete my account&rdquo;. We&apos;ll check it&apos;s you and delete your account within 7 days.
      </LegalP>
    ),
  },
  {
    id: "what-is-deleted",
    title: "What is deleted",
    content: (
      <LegalP>
        Your profile and account, meals and scans, conversations, goals, plans, recipes, medicines and their photos,
        prescriptions, dose history, reminders, step counts and other health data, connected phones and notification
        addresses, credit history and requests, and reports you sent about AI answers. You are signed out everywhere.
      </LegalP>
    ),
  },
  {
    id: "what-is-kept",
    title: "What is kept",
    content: (
      <LegalP>
        Nothing from your account. If you also joined our updates list or a plan waitlist, that email address stays until you
        ask us to remove it.
      </LegalP>
    ),
  },
  {
    id: "delete-some-data",
    title: "Delete some data and keep your account",
    content: (
      <LegalP>
        Delete any meal, medicine or chat in the app; change or remove what ÖRZA remembers in{" "}
        <B>Settings › What ÖRZA remembers</B>. To delete the health data your phone sent (steps, sleep, resting heart rate,
        weight) and keep your account, email <SupportEmail subject="Delete my phone health data" /> with the subject{" "}
        &ldquo;Delete my phone health data&rdquo;.
      </LegalP>
    ),
  },
];

export default function DeleteAccountPage() {
  return (
    <LegalPage
      docName="account deletion page"
      eyebrow="Your data"
      icon={<Trash2 size={12} strokeWidth={1.75} className="text-orza-cyan-600" aria-hidden />}
      title={
        <>
          Delete your ÖRZA <Accent>account</Accent>
        </>
      }
      lead={`ÖRZA is made by ${PRIVACY_CONTROLLER_NAME}. You can delete your ÖRZA account and all of its data at any time. Deleting is permanent and can’t be undone.`}
      sections={SECTIONS}
      updated={DELETE_ACCOUNT_UPDATED}
      related={[
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ]}
      contactSubject="Account deletion question"
      contactTitle="Questions about deleting your account?"
    />
  );
}
