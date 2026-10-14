import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin, toPublicUser } from "@/lib/auth";
import { UserProvider } from "@/components/app/UserProvider";
import { AppShell } from "@/components/app/AppShell";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/**
 * Members get the ÖRZA app (and finish onboarding first). Admin accounts are staff-only: they get the
 * separate admin console, never onboarding, and AdminShell sends them from any member route to
 * /dashboard/admin without rendering that member page.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  if (isAdmin(user)) {
    return (
      <UserProvider initialUser={toPublicUser(user)}>
        <AdminShell>{children}</AdminShell>
      </UserProvider>
    );
  }

  if (!user.onboarding_complete) redirect("/onboarding");
  return (
    <UserProvider initialUser={toPublicUser(user)}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  );
}
