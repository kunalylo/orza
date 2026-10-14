import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin console",
  robots: { index: false, follow: false },
};

/** The admin console is for staff accounts only; members are sent back to their app (the APIs refuse them too). */
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fdashboard%2Fadmin");
  if (!isAdmin(user)) redirect("/dashboard");
  return <>{children}</>;
}
