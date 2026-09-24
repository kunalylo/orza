"use client";
import * as React from "react";
import { RotateCw, ShieldAlert } from "lucide-react";
import { useUser } from "@/components/app/UserProvider";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";
import { Button, ButtonLink } from "@/components/ui/button";
import { AdjustCreditsDialog } from "@/components/account/admin/AdjustCreditsDialog";
import { AdminOverview, AdminOverviewSkeleton } from "@/components/account/admin/AdminOverview";
import { UsersTable } from "@/components/account/admin/UsersTable";
import { LoadError } from "@/components/account/ui";
import type { AdjustResponse, AdminStats, AdminUserRow } from "@/components/account/types";
import { api, ApiError, errorMessage } from "@/lib/api-client";

/** Shown to members without admin access (the server enforces this too). */
function NotAuthorised() {
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Admin panel" />
      <EmptyState
        icon={<ShieldAlert size={20} strokeWidth={1.75} aria-hidden />}
        title="This area is for the ÖRZA team"
        description="You need admin access to view this page. If you think that's a mistake, ask an existing admin to add your email to the admin list."
        action={
          <ButtonLink href="/dashboard" variant="secondary">
            Back to Today
          </ButtonLink>
        }
      />
    </div>
  );
}

function AdminConsole() {
  const { user, setCredits } = useUser();
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [error, setError] = React.useState<{ message: string; forbidden: boolean } | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [target, setTarget] = React.useState<AdminUserRow | null>(null);
  const [adjusted, setAdjusted] = React.useState<{ userId: string; balance: number } | null>(null);

  const loadStats = React.useCallback(async () => {
    try {
      const s = await api.get<AdminStats>("/admin/stats");
      setStats(s);
      setError(null);
    } catch (e) {
      setError({ message: errorMessage(e), forbidden: e instanceof ApiError && e.status === 403 });
    }
  }, []);

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

  async function refresh() {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    await loadStats();
    setRefreshing(false);
  }

  function onAdjusted(userId: string, res: AdjustResponse) {
    setAdjusted({ userId, balance: res.balance });
    if (userId === user.id) setCredits(res.balance); // keep the sidebar pill honest when adjusting yourself
    loadStats(); // credits-used total may have changed
  }

  if (error?.forbidden) return <NotAuthorised />;

  return (
    <div>
      <PageHeader
        eyebrow="Admin · team only"
        title="Admin panel"
        description="Platform overview and user management."
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing} disabled={!stats && !error}>
            {!refreshing && <RotateCw size={14} strokeWidth={1.75} aria-hidden />}
            Refresh
          </Button>
        }
      />

      {error && !stats ? (
        <LoadError title="We couldn’t load the platform stats" message={error.message} onRetry={refresh} />
      ) : !stats ? (
        <AdminOverviewSkeleton />
      ) : (
        <AdminOverview stats={stats} />
      )}

      <Reveal className="mt-8 lg:mt-10">
        <UsersTable currentUserId={user.id} refreshKey={refreshKey} onAdjust={setTarget} adjusted={adjusted} />
      </Reveal>

      <AdjustCreditsDialog target={target} onClose={() => setTarget(null)} onAdjusted={onAdjusted} />
    </div>
  );
}

/** Admin: platform stats, AI/database status, member search and manual credit adjustments. */
export default function AdminPage() {
  const { user } = useUser();
  if (!user.is_admin) return <NotAuthorised />;
  return <AdminConsole />;
}
