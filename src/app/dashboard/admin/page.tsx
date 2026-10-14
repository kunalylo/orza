"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Inbox, RotateCw, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";
import { useUser } from "@/components/app/UserProvider";
import { PageHeader } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";
import { IconTile, Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { AdminOverview, AdminOverviewSkeleton } from "@/components/account/admin/AdminOverview";
import { LoadError, plural } from "@/components/account/ui";
import { ADMIN_HOME } from "@/components/admin/routes";
import type { ConsoleStats } from "@/components/admin/types";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";

function ShortcutCard({
  href,
  icon: Icon,
  title,
  body,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full items-start gap-3.5 rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.62)] p-5 shadow-orza-glass backdrop-blur-orza transition-[background-color,box-shadow] duration-220 ease-orza hover:bg-[rgba(255,255,255,0.80)] hover:shadow-orza-glass-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan"
    >
      <IconTile tone="neutral">
        <Icon size={17} strokeWidth={1.75} aria-hidden />
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-editorial text-[18px] font-semibold leading-6 text-orza-strong">{title}</span>
          {badge}
        </span>
        <span className="mt-1 block text-[13px] leading-relaxed text-orza-muted">{body}</span>
      </span>
      <ArrowUpRight
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className="mt-1 shrink-0 text-orza-subtle transition-transform duration-220 ease-orza group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-orza-strong"
      />
    </Link>
  );
}

/** Admin console — Overview: member stats, AI / database status and shortcuts to the other pages. */
export default function AdminOverviewPage() {
  const { user } = useUser();
  const [stats, setStats] = React.useState<ConsoleStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setStats(await api.get<ConsoleStats>("/admin/stats"));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const first = user.name?.trim().split(/\s+/)[0];
  const open = stats?.open_requests ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Admin console"
        title="Overview"
        description={`${first ? `Welcome back, ${first}. ` : ""}How ÖRZA's members are doing — every number counts members only; staff accounts are left out.`}
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing} disabled={!stats && !error}>
            {!refreshing && <RotateCw size={14} strokeWidth={1.75} aria-hidden />}
            Refresh
          </Button>
        }
      />

      {error && !stats ? (
        <LoadError title="We couldn’t load the platform stats" message={error} onRetry={refresh} />
      ) : !stats ? (
        <AdminOverviewSkeleton />
      ) : (
        <AdminOverview stats={stats} />
      )}

      <Reveal className="mt-8 lg:mt-10">
        <h2 className="sr-only">Shortcuts</h2>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ShortcutCard
            href={`${ADMIN_HOME}/requests`}
            icon={Inbox}
            title="Credit requests"
            body="Members asking for more AI credits, oldest first."
            badge={
              stats ? (
                open > 0 ? (
                  <Tag tone="warning" size="sm">
                    {plural(open, "open")}
                  </Tag>
                ) : (
                  <Tag tone="success" size="sm">
                    All caught up
                  </Tag>
                )
              ) : undefined
            }
          />
          <ShortcutCard
            href={`${ADMIN_HOME}/members`}
            icon={UsersRound}
            title="Members"
            body="Search members by name or email and adjust their credits."
            badge={
              stats ? (
                <Tag tone="neutral" size="sm" dot={false}>
                  {formatNumber(stats.users)}
                </Tag>
              ) : undefined
            }
          />
          {user.admin_role === "super" && (
            <ShortcutCard href={`${ADMIN_HOME}/team`} icon={ShieldCheck} title="Team" body="Add sub-admins, reset their passwords or remove them." />
          )}
        </div>
      </Reveal>
    </div>
  );
}
