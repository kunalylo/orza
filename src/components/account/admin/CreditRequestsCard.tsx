"use client";
import * as React from "react";
import { Check, Coins, Inbox, Mail } from "lucide-react";
import { toast } from "sonner";
import { Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { formatDateTime, plural, relativeDay } from "@/components/account/ui";
import type { AdminCreditRequest, AdminCreditRequestsResponse, AdminUserRow } from "@/components/account/types";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";

/**
 * Open "Request more credits" messages from signed-in members, oldest first. "Top up" opens the
 * adjust dialog for that member (a grant closes their open requests on the server); "Mark done"
 * closes a request that was answered another way. `refreshKey` reloads the list.
 */
export function CreditRequestsCard({ refreshKey, onTopUp }: { refreshKey: number; onTopUp: (u: AdminUserRow) => void }) {
  const [requests, setRequests] = React.useState<AdminCreditRequest[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [closing, setClosing] = React.useState<string | null>(null);
  const reqId = React.useRef(0);

  const load = React.useCallback(async () => {
    const id = ++reqId.current;
    setError(null);
    try {
      const res = await api.get<AdminCreditRequestsResponse>("/admin/credit-requests");
      if (id === reqId.current) setRequests(res.requests);
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function markDone(r: AdminCreditRequest) {
    setClosing(r.id);
    try {
      await api.patch(`/admin/credit-requests/${encodeURIComponent(r.id)}`, { status: "done" });
      setRequests((list) => list && list.filter((x) => x.id !== r.id));
      toast.success("Request marked as done", { description: `From ${r.user?.name || r.name || r.email}.` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setClosing(null);
    }
  }

  return (
    <GlassCard as="section" aria-labelledby="admin-requests-title" variant="strong">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow className="text-[11px]">Inbox</Eyebrow>
          <h2 id="admin-requests-title" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
            Credit requests
          </h2>
          <p className="mt-1 text-[13px] text-orza-muted">
            Sent from members&rsquo; Credits page. Adding credits closes their open requests; reply by email as well.
          </p>
        </div>
        {requests && requests.length > 0 && (
          <Tag tone="warning" size="sm">
            {plural(requests.length, "open request")}
          </Tag>
        )}
      </div>

      {error && !requests ? (
        <div role="alert" className="mt-5 flex flex-col items-start gap-3 rounded-orza-sm border border-[rgba(176,44,44,0.20)] bg-[#FDECEC]/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-[#B02C2C]">{error}</p>
          <Button variant="secondary" size="sm" onClick={load}>
            Try again
          </Button>
        </div>
      ) : !requests ? (
        <div className="mt-5 flex flex-col gap-2.5" aria-busy="true" aria-label="Loading credit requests">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-orza-sm" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-5 flex items-center gap-3 rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.12)] bg-white/40 px-4 py-4 text-[13px] text-orza-muted">
          <Inbox size={18} strokeWidth={1.75} className="shrink-0 text-orza-subtle" aria-hidden />
          No open requests — you&rsquo;re all caught up.
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-2.5" aria-label="Open credit requests, oldest first">
          {requests.map((r) => {
            const who = r.user?.name || r.name || "Member";
            const email = r.user?.email || r.email;
            return (
              <li key={r.id} className="rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 p-3.5 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="truncate text-[14px] font-medium text-orza-strong">{who}</span>
                      <a
                        href={`mailto:${email}?subject=${encodeURIComponent("Your ÖRZA credits")}`}
                        className="inline-flex min-w-0 items-center gap-1 truncate text-[12px] text-orza-subtle underline-offset-2 hover:text-orza-strong hover:underline"
                      >
                        <Mail size={12} strokeWidth={1.75} aria-hidden />
                        <span className="truncate">{email}</span>
                      </a>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line break-words text-[13px] leading-relaxed text-orza-muted">{r.message}</p>
                    <p className="mt-2 text-[12px] text-orza-subtle">
                      <time dateTime={r.created_at} title={formatDateTime(r.created_at)}>
                        {relativeDay(r.created_at)}
                      </time>
                      {" · "}
                      {formatNumber(r.balance)} credits when sent
                      {r.user && r.user.credits !== r.balance ? ` · ${formatNumber(r.user.credits)} now` : ""}
                      {!r.user && " · account deleted"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markDone(r)}
                      loading={closing === r.id}
                      disabled={!!closing && closing !== r.id}
                      aria-label={`Mark the request from ${who} as done`}
                    >
                      {closing !== r.id && <Check size={14} strokeWidth={1.75} aria-hidden />}
                      Mark done
                    </Button>
                    {r.user && (
                      <Button variant="primary" size="sm" onClick={() => onTopUp(r.user as AdminUserRow)} aria-label={`Add credits for ${who}`}>
                        <Coins size={14} strokeWidth={1.75} aria-hidden /> Top up
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
