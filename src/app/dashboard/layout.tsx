import { redirect } from "next/navigation";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { UserProvider } from "@/components/app/UserProvider";
import { AppShell } from "@/components/app/AppShell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (!user.onboarding_complete) redirect("/onboarding");
  return (
    <UserProvider initialUser={toPublicUser(user)}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
