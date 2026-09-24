"use client";
import * as React from "react";
import { Coins, Loader2, Search, UsersRound, X } from "lucide-react";
import { EmptyState } from "@/components/app/ui";
import { Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Input, Skeleton } from "@/components/ui/form";
import { formatDate, relativeDay } from "@/components/account/ui";
import type { AdminUserRow, AdminUsersResponse } from "@/components/account/types";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatNumber } from "@/lib/utils";

const PAGE = 50;
const MAX_LIMIT = 200;
const DEBOUNCE_MS = 300;

function initialOf(u: AdminUserRow) {
  return (u.name || u.email || "?").trim().slice(0, 1).toUpperCase();
}

/** "Joined today" / "Joined 3 days ago" / "Joined on 2 Sept 2026". */
function joinedLabel(iso: string) {
  const r = relativeDay(iso);
  if (!r) return "Joined";
  if (r === "Today" || r === "Yesterday") return `Joined ${r.toLowerCase()}`;
  return r.endsWith("ago") ? `Joined ${r}` : `Joined on ${r}`;
}

function Avatar({ user }: { user: AdminUserRow }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-editorial text-[15px] font-semibold",
        user.is_admin ? "bg-orza-energy text-white" : "border border-[rgba(20,20,20,0.10)] bg-white/80 text-orza-strong"
      )}
    >
      {initialOf(user)}
    </span>
  );
}

function StatusTags({ user, isSelf }: { user: AdminUserRow; isSelf: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {isSelf && (
        <Tag tone="energy" size="sm" dot={false}>
          You
        </Tag>
      )}
      {user.is_admin && (
        <Tag tone="violet" size="sm">
          Admin
        </Tag>
      )}
      {user.onboarding_complete ? (
        <Tag tone="success" size="sm">
          Onboarded
        </Tag>
      ) : (
        <Tag tone="warning" size="sm">
          Setting up
        </Tag>
      )}
    </span>
  );
}

function RowsSkeleton() {
  return (
    <div className="mt-5 flex flex-col gap-2.5" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-[60px] rounded-orza-sm" />
      ))}
    </div>
  );
}

/**
 * Member directory for admins: debounced name/email search over the newest 500 members,
 * with a credit-adjust action per row. `refreshKey` forces a reload from the parent.
 */
export function UsersTable({
  currentUserId,
  refreshKey,
  onAdjust,
  adjusted,
}: {
  currentUserId: string;
  refreshKey: number;
  onAdjust: (u: AdminUserRow) => void;
  /** The latest credit adjustment; its new balance is written into the loaded rows. */
  adjusted: { userId: string; balance: number } | null;
}) {
  const [query, setQuery] = React.useState("");
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);
  const [data, setData] = React.useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const reqId = React.useRef(0);

  // Debounce the search box; a new search starts again from the first page.
  React.useEffect(() => {
    const next = query.trim();
    if (next === q) return;
    const t = setTimeout(() => {
      setQ(next);
      setLimit(PAGE);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, q]);

  const load = React.useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (q) params.set("q", q);
      const res = await api.get<AdminUsersResponse>(`/admin/users?${params.toString()}`);
      if (id === reqId.current) setData(res);
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [q, limit]);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  React.useEffect(() => {
    if (!adjusted) return;
    setData((d) => d && { ...d, users: d.users.map((u) => (u.id === adjusted.userId ? { ...u, credits: adjusted.balance } : u)) });
  }, [adjusted]);

  const rows = data?.users ?? [];
  const total = data?.total ?? rows.length;
  const canShowMore = !!data && total > rows.length && limit < MAX_LIMIT;
  const searching = loading && !!data;

  return (
    <GlassCard as="section" aria-labelledby="admin-users-title" variant="strong">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow className="text-[11px]">Members</Eyebrow>
          <h2 id="admin-users-title" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
            User management
          </h2>
          <p className="mt-1 text-[13px] text-orza-muted">Search by name or email and top up credits by hand.</p>
        </div>
        <div className="relative w-full md:w-[320px]">
          <label htmlFor="admin-user-search" className="sr-only">
            Search members by name or email
          </label>
          <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-orza-subtle" aria-hidden />
          <Input
            id="admin-user-search"
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            autoComplete="off"
            spellCheck={false}
            className="pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
          />
          {searching ? (
            <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-orza-subtle" aria-hidden />
          ) : query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-orza-subtle hover:bg-black/5 hover:text-orza-strong"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {data && !loading ? (q ? `${total} members match “${q}”` : `${total} members`) : ""}
      </p>

      {error && !data ? (
        <div role="alert" className="mt-5 flex flex-col items-start gap-3 rounded-orza-sm border border-[rgba(176,44,44,0.20)] bg-[#FDECEC]/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[#B02C2C]">{error}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<UsersRound size={20} strokeWidth={1.75} aria-hidden />}
          title={q ? "No members match" : "No members yet"}
          description={q ? `Nothing in the newest 500 members matches “${q}”. Try part of an email address.` : "New sign-ups will appear here."}
          action={
            q ? (
              <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("transition-opacity duration-150", searching && "opacity-60")} aria-busy={loading}>
          {/* Desktop / tablet table */}
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Members, newest first</caption>
              <thead>
                <tr className="border-b border-[rgba(20,20,20,0.08)]">
                  {["Member", "Status", "Joined", "Credits"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn("pb-2.5 font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-orza-subtle", i === 3 && "text-right")}
                    >
                      {h}
                    </th>
                  ))}
                  <th scope="col" className="pb-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-[rgba(20,20,20,0.06)] transition-colors duration-150 last:border-0 hover:bg-white/50">
                    <th scope="row" className="py-3 pr-4 font-normal">
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar user={u} />
                        <span className="min-w-0">
                          <span className="block max-w-[260px] truncate text-[14px] font-medium text-orza-strong">{u.name || "Unnamed"}</span>
                          <span className="block max-w-[260px] truncate text-[12px] text-orza-subtle">{u.email}</span>
                        </span>
                      </span>
                    </th>
                    <td className="py-3 pr-4">
                      <StatusTags user={u} isSelf={u.id === currentUserId} />
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-[13px] text-orza-muted">
                      <time dateTime={u.created_at} title={formatDate(u.created_at)}>
                        {relativeDay(u.created_at)}
                      </time>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="font-editorial text-[18px] font-semibold tabular-nums text-orza-strong">{formatNumber(u.credits)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <Button variant="secondary" size="sm" onClick={() => onAdjust(u)} aria-label={`Adjust credits for ${u.name || u.email}`}>
                        <Coins size={14} strokeWidth={1.75} aria-hidden /> Adjust
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: stacked cards */}
          <ul className="mt-5 flex flex-col gap-2.5 md:hidden" aria-label="Members, newest first">
            {rows.map((u) => (
              <li key={u.id} className="rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 p-3.5">
                <div className="flex items-start gap-3">
                  <Avatar user={u} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-orza-strong">{u.name || "Unnamed"}</div>
                    <div className="truncate text-[12px] text-orza-subtle">{u.email}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-editorial text-[20px] font-semibold leading-6 tabular-nums text-orza-strong">{formatNumber(u.credits)}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-orza-subtle">credits</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusTags user={u} isSelf={u.id === currentUserId} />
                    <span className="text-[12px] text-orza-subtle">
                      · <time dateTime={u.created_at}>{joinedLabel(u.created_at)}</time>
                    </span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => onAdjust(u)} aria-label={`Adjust credits for ${u.name || u.email}`}>
                    <Coins size={14} strokeWidth={1.75} aria-hidden /> Adjust
                  </Button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(20,20,20,0.06)] pt-4">
            <span className="text-xs text-orza-subtle">
              Showing {formatNumber(rows.length)} of {formatNumber(total)}
              {q ? ` matching “${q}”` : ""} · searches the newest 500 members
            </span>
            {canShowMore && (
              <Button variant="ghost" size="sm" onClick={() => setLimit((l) => Math.min(MAX_LIMIT, l + PAGE))} disabled={loading}>
                Show more
              </Button>
            )}
          </div>
          {error && <p role="alert" className="mt-2 text-xs text-[#B02C2C]">{error}</p>}
        </div>
      )}
    </GlassCard>
  );
}
