"use client";
import { KeyRound, LogOut, MonitorSmartphone, UserRound } from "lucide-react";
import { useUser } from "@/components/app/UserProvider";
import { useSignOut } from "@/components/app/useSignOut";
import { PageHeader } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";
import { Button } from "@/components/ui/button";
import { SectionCard, formatDate } from "@/components/account/ui";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { RoleTag, roleLabel } from "@/components/admin/ui";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{label}</dt>
      <dd className="mt-1 truncate text-[15px] text-orza-strong">{children}</dd>
    </div>
  );
}

/** Admin console — My account: who you're signed in as, change password, sign out. */
export default function AdminAccountPage() {
  const { user } = useUser();
  const { signOut, signingOut } = useSignOut();
  const isSuper = user.admin_role === "super";

  return (
    <div>
      <PageHeader eyebrow="Admin console" title="My account" description="Your staff sign-in. Keep the password to yourself — it opens the whole console." />

      <div className="flex flex-col gap-5 lg:gap-6">
        <Reveal y={10}>
          <SectionCard
            id="admin-profile"
            icon={<UserRound size={18} strokeWidth={1.75} aria-hidden />}
            eyebrow="Profile"
            title={user.name || "Admin"}
            description={
              isSuper
                ? "Super admins run the console and manage the team."
                : "Sub-admins run the console: members, credits and credit requests. Ask a super admin to change your name or email."
            }
            actions={<RoleTag role={user.admin_role} size="md" />}
          >
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label="Name">{user.name || "—"}</Detail>
              <Detail label="Email">{user.email}</Detail>
              <Detail label="Role">{roleLabel(user.admin_role)}</Detail>
              {user.created_at && <Detail label="Account created">{formatDate(user.created_at)}</Detail>}
            </dl>
          </SectionCard>
        </Reveal>

        <Reveal y={10}>
          <SectionCard
            id="admin-password"
            icon={<KeyRound size={18} strokeWidth={1.75} aria-hidden />}
            tone="energy"
            eyebrow="Security"
            title="Change password"
            description="If someone gave you a temporary password, replace it with one only you know."
          >
            <ChangePasswordForm username={user.email} />
          </SectionCard>
        </Reveal>

        <Reveal y={10}>
          <SectionCard
            id="admin-sessions"
            icon={<MonitorSmartphone size={18} strokeWidth={1.75} aria-hidden />}
            eyebrow="Sessions"
            title="Sign out"
            description="Sign out of this browser, or of every device where your admin account is signed in."
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => void signOut()} loading={signingOut}>
                {!signingOut && <LogOut size={15} strokeWidth={1.75} aria-hidden />}
                Sign out
              </Button>
              <Button variant="ghost" onClick={() => void signOut({ everywhere: true })} disabled={signingOut}>
                Sign out everywhere
              </Button>
            </div>
          </SectionCard>
        </Reveal>
      </div>
    </div>
  );
}
