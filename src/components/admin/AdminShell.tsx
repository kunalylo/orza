"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { BrandMark } from "@/components/orza/primitives";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/form";
import { useUser } from "@/components/app/UserProvider";
import { useSignOut } from "@/components/app/useSignOut";
import { cn } from "@/lib/utils";
import { ADMIN_HOME, ADMIN_NAV, isActiveNav, isConsolePath } from "./routes";
import { RoleTag } from "./ui";

function ConsoleLabel({ className }: { className?: string }) {
  return <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em] text-orza-subtle", className)}>Admin console</span>;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() || "";
  const { user } = useUser();
  const items = ADMIN_NAV.filter((n) => !n.superOnly || user.admin_role === "super");
  return (
    <nav aria-label="Admin console" className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActiveNav(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-orza-sm px-3 py-2.5 text-[14px] transition-colors duration-150 ease-orza",
              active
                ? "border border-[rgba(20,20,20,0.08)] bg-white/90 font-medium text-orza-strong shadow-[0_6px_18px_rgba(20,20,20,0.06)]"
                : "border border-transparent text-orza-muted hover:bg-white/60 hover:text-orza-strong"
            )}
          >
            <Icon size={17} strokeWidth={1.75} aria-hidden className={cn(active ? "text-[#E0593F]" : "opacity-70 group-hover:opacity-100")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Shown for a moment while an admin is sent from a member route to the console. */
function Redirecting() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Opening the admin console…
      </p>
      <Skeleton className="h-10 w-56 rounded-orza-sm" />
      <Skeleton className="mt-4 h-5 w-80 max-w-full rounded-orza-xs" />
      <Skeleton className="mt-8 h-[260px] rounded-orza-xl" />
    </div>
  );
}

/**
 * The staff-only shell for admin accounts: same visual language as the member AppShell (sidebar on
 * desktop, top bar + menu drawer on mobile) but only the console's own pages — no credits, no member
 * features, no medicine alarms. Any non-console route is replaced with /dashboard/admin and its member
 * content is never rendered meanwhile.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, signingOut } = useSignOut();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const inConsole = isConsolePath(pathname);
  const initials = (user.name || user.email).trim().slice(0, 1).toUpperCase();

  React.useEffect(() => {
    if (!inConsole) router.replace(ADMIN_HOME);
  }, [inConsole, router]);

  return (
    <div className="min-h-screen bg-orza-bg-0 orza-canvas-grain">
      {/* Desktop sidebar */}
      <aside className="print:hidden fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[rgba(20,20,20,0.08)] bg-orza-bg-1/80 backdrop-blur-orza lg:flex">
        <div className="flex flex-col gap-1 px-5 pb-3 pt-5">
          <Link href={ADMIN_HOME} aria-label="ÖRZA admin console — overview" className="self-start">
            <BrandMark className="text-orza-strong" showPronunciation={false} />
          </Link>
          <ConsoleLabel className="pl-9" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
          <NavList />
        </div>
        <div className="border-t border-[rgba(20,20,20,0.08)] p-4">
          <RoleTag role={user.admin_role} />
          <div className="mt-3 flex items-center gap-3">
            <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#141414] text-sm font-semibold text-orza-bg-0">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-orza-strong">{user.name || "Admin"}</div>
              <div className="truncate text-xs text-orza-subtle">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={signingOut}
              aria-label={signingOut ? "Signing out" : "Sign out"}
              aria-busy={signingOut}
              title="Sign out"
              className="rounded-full p-2 text-orza-muted hover:bg-white/70 hover:text-orza-strong disabled:cursor-wait disabled:opacity-60"
            >
              <LogOut size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="print:hidden sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[rgba(20,20,20,0.08)] bg-[rgba(251,247,241,0.85)] px-4 backdrop-blur-orza lg:hidden">
        <Link href={ADMIN_HOME} aria-label="ÖRZA admin console — overview" className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="text-orza-strong" showPronunciation={false} />
          <span className="rounded-full border border-[rgba(20,20,20,0.10)] bg-white/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-orza-muted">
            Admin
          </span>
        </Link>
        <button
          type="button"
          aria-label="Open admin menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white/70"
        >
          <Menu size={17} strokeWidth={1.75} aria-hidden />
        </button>
      </header>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent side="right" title={user.name || "Admin"} description={user.email}>
          <div className="-mt-1 mb-5 flex flex-wrap items-center gap-2">
            <RoleTag role={user.admin_role} />
            <ConsoleLabel />
          </div>
          <NavList onNavigate={() => setMenuOpen(false)} />
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            aria-busy={signingOut}
            className="mt-6 flex w-full items-center gap-3 rounded-orza-sm px-3 py-2.5 text-[14px] text-orza-muted hover:bg-white/60 hover:text-orza-strong disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut size={17} strokeWidth={1.75} aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </DialogContent>
      </Dialog>

      <main className="lg:pl-[248px] print:pl-0">
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">{inConsole ? children : <Redirecting />}</div>
      </main>
    </div>
  );
}
