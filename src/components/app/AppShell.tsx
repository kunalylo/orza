"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Camera,
  HeartPulse,
  Pill,
  ChefHat,
  HeartHandshake,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Target,
  UtensilsCrossed,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { BrandMark } from "@/components/orza/primitives";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUser } from "@/components/app/UserProvider";
import { api } from "@/lib/api-client";
import { AlarmWatcher } from "@/components/care/AlarmWatcher";

export const APP_NAV = [
  { href: "/dashboard", label: "Today", icon: Sun },
  { href: "/dashboard/chat", label: "Ask ÖRZA", icon: MessageCircle },
  { href: "/dashboard/scan", label: "Snap & Know", icon: Camera },
  { href: "/dashboard/meals", label: "Meal log", icon: UtensilsCrossed },
  { href: "/dashboard/medicines", label: "Medicines", icon: Pill },
  { href: "/dashboard/reminders", label: "Reminders", icon: Bell },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/health", label: "Health sync", icon: HeartPulse },
  { href: "/dashboard/goals", label: "Goals", icon: Target },
  { href: "/dashboard/recipes", label: "Recipes", icon: ChefHat },
  { href: "/dashboard/compensation", label: "Rebalance", icon: HeartHandshake },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/credits", label: "AI credits", icon: Sparkles },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

const MOBILE_TABS = ["/dashboard", "/dashboard/meals", "/dashboard/scan", "/dashboard/medicines"];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(href + "/");
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();
  const items = user.is_admin ? [...APP_NAV, { href: "/dashboard/admin", label: "Admin", icon: Shield }] : APP_NAV;
  return (
    <nav aria-label="App" className="flex flex-col gap-0.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-orza-sm px-3 py-2.5 text-[14px] transition-colors duration-150 ease-orza",
              active
                ? "bg-white/90 text-orza-strong font-medium shadow-[0_6px_18px_rgba(20,20,20,0.06)] border border-[rgba(20,20,20,0.08)]"
                : "text-orza-muted hover:bg-white/60 hover:text-orza-strong border border-transparent"
            )}
          >
            <Icon size={17} strokeWidth={1.75} className={cn(active ? "text-[#E0593F]" : "opacity-70 group-hover:opacity-100")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function CreditsPill({ className }: { className?: string }) {
  const { user } = useUser();
  return (
    <Link
      href="/dashboard/credits"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,122,106,0.28)] bg-[#FFF1EA] px-3 py-1 text-[12px] font-medium text-[#C2410C]",
        className
      )}
      title="AI credits remaining"
    >
      <Sparkles size={13} strokeWidth={2} /> {formatNumber(user.credits)} credits
    </Link>
  );
}

function useSignOut() {
  const router = useRouter();
  return React.useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      router.replace("/");
      router.refresh();
    }
  }, [router]);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const signOut = useSignOut();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const initials = (user.name || user.email).trim().slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-orza-bg-0 orza-canvas-grain">
      {/* Desktop sidebar */}
      <aside className="print:hidden fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-[rgba(20,20,20,0.08)] bg-orza-bg-1/80 backdrop-blur-orza lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard" aria-label="ÖRZA home">
            <BrandMark className="text-orza-strong" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
          <NavList />
        </div>
        <div className="border-t border-[rgba(20,20,20,0.08)] p-4">
          <CreditsPill />
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-orza-energy text-sm font-semibold text-white">{initials}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-orza-strong">{user.name || "You"}</div>
              <div className="truncate text-xs text-orza-subtle">{user.email}</div>
            </div>
            <button type="button" onClick={signOut} aria-label="Sign out" className="rounded-full p-2 text-orza-muted hover:bg-white/70 hover:text-orza-strong">
              <LogOut size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="print:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[rgba(20,20,20,0.08)] bg-[rgba(251,247,241,0.85)] px-4 backdrop-blur-orza lg:hidden">
        <Link href="/dashboard" aria-label="ÖRZA home">
          <BrandMark className="text-orza-strong" showPronunciation={false} />
        </Link>
        <div className="flex items-center gap-2">
          <CreditsPill />
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white/70"
          >
            <Menu size={17} strokeWidth={1.75} />
          </button>
        </div>
      </header>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent side="right" title={user.name || "ÖRZA"} description={user.email}>
          <NavList onNavigate={() => setMenuOpen(false)} />
          <button
            type="button"
            onClick={signOut}
            className="mt-6 flex w-full items-center gap-3 rounded-orza-sm px-3 py-2.5 text-[14px] text-orza-muted hover:bg-white/60 hover:text-orza-strong"
          >
            <LogOut size={17} strokeWidth={1.75} /> Sign out
          </button>
        </DialogContent>
      </Dialog>

      <AlarmWatcher />

      <main className="lg:pl-[248px] print:pl-0">
        <div className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</div>
      </main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Quick"
        className="print:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[rgba(20,20,20,0.08)] bg-[rgba(251,247,241,0.92)] pb-[env(safe-area-inset-bottom)] backdrop-blur-orza lg:hidden"
      >
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((href) => {
            const item = APP_NAV.find((n) => n.href === href)!;
            const Icon = item.icon;
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px]", active ? "text-orza-strong font-medium" : "text-orza-subtle")}>
                <Icon size={19} strokeWidth={1.75} className={active ? "text-[#E0593F]" : ""} />
                {item.label}
              </Link>
            );
          })}
          <button type="button" onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-orza-subtle">
            <Menu size={19} strokeWidth={1.75} />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
