import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { OnboardingChat } from "@/components/auth/onboarding/OnboardingChat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Let's get to know you",
  description: "A few quick questions so ÖRZA can personalise your targets, suggestions and chat.",
  robots: { index: false, follow: false },
};

/**
 * /onboarding — full-screen conversational setup. Finished users go straight to the dashboard;
 * admin (staff) accounts never onboard and go to the admin console.
 */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fonboarding");
  if (isAdmin(user)) redirect("/dashboard/admin");
  if (user.onboarding_complete) redirect("/dashboard");

  return (
    <main>
      <OnboardingChat name={user.name} />
    </main>
  );
}
