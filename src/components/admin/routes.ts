/** Admin console routes (pure data — safe to import from any client component). */
import { Inbox, LayoutDashboard, ShieldCheck, UserRound, UsersRound, type LucideIcon } from "lucide-react";

export const ADMIN_HOME = "/dashboard/admin";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown to super admins only (the page and its API refuse sub-admins too). */
  superOnly?: boolean;
};

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: ADMIN_HOME, label: "Overview", icon: LayoutDashboard },
  { href: `${ADMIN_HOME}/members`, label: "Members", icon: UsersRound },
  { href: `${ADMIN_HOME}/requests`, label: "Credit requests", icon: Inbox },
  { href: `${ADMIN_HOME}/team`, label: "Team", icon: ShieldCheck, superOnly: true },
  { href: `${ADMIN_HOME}/account`, label: "My account", icon: UserRound },
];

/** True for /dashboard/admin and everything under it — the only app routes an admin account uses. */
export function isConsolePath(path: string | null | undefined): boolean {
  if (!path) return false;
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`);
}

export function isActiveNav(pathname: string, href: string) {
  return href === ADMIN_HOME ? pathname === ADMIN_HOME : pathname === href || pathname.startsWith(`${href}/`);
}
