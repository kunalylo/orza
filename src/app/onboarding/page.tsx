import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { OnboardingChat } from "@/components/auth/onboarding/OnboardingChat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Let's get to know you",
  description: "A few quick questions so ÖRZA can personalise your targets, suggestions and chat.",
  robots: { index: false, follow: false },
};

/** /onboarding — full-screen conversational setup. Finished users go straight to the dashboard. */
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fonboarding");
  if (user.onboarding_complete) redirect("/dashboard");

  return (
    <main>
      <OnboardingChat name={user.name} />
    </main>
  );
}
