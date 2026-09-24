"use client";
import * as React from "react";
import { Gift, History, RotateCcw, Sparkles } from "lucide-react";
import { Eyebrow, GlassCard, IconTile } from "@/components/orza/primitives";
import { EmptyState } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { ACTION_ICONS } from "@/components/account/credits/CostsCard";
import { transactionAction, transactionLabel } from "@/components/account/options";
import { formatDateTime } from "@/components/account/ui";
import type { CreditTransaction } from "@/lib/types";
import { cn, formatNumber } from "@/lib/utils";

type Filter = "all" | "used" | "added";
const PAGE = 15;

function TxIcon({ tx }: { tx: CreditTransaction }) {
  const refund = /^refund:/i.test(tx.reason || "");
  const action = transactionAction(tx.reason);
  if (refund) {
    return (
      <IconTile tone="cyan" className="h-9 w-9">
        <RotateCcw size={15} strokeWidth={1.75} aria-hidden />
      </IconTile>
    );
  }
  if (tx.amount < 0 && action) {
    const Icon = ACTION_ICONS[action];
    return (
      <IconTile tone="neutral" className="h-9 w-9">
        <Icon size={15} strokeWidth={1.75} aria-hidden />
      </IconTile>
    );
  }
  const welcome = /welcome/i.test(tx.reason || "");
  return (
    <IconTile tone="energy" className="h-9 w-9">
      {welcome ? <Gift size={15} strokeWidth={1.75} aria-hidden /> : <Sparkles size={15} strokeWidth={1.75} aria-hidden />}
    </IconTile>
  );
}

/** Credit activity: newest first, filterable, paged 15 at a time. */
export function TransactionHistory({ transactions, className }: { transactions: CreditTransaction[]; className?: string }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [shown, setShown] = React.useState(PAGE);

  const rows = React.useMemo(
    () => transactions.filter((t) => (filter === "all" ? true : filter === "used" ? t.amount < 0 : t.amount > 0)),
    [transactions, filter]
  );
  const visible = rows.slice(0, shown);

  return (
    <GlassCard as="section" aria-labelledby="history-title" variant="strong" className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Eyebrow className="text-[11px]">History</Eyebrow>
          <h2 id="history-title" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
            Credit activity
          </h2>
        </div>
        {transactions.length > 0 && (
          <Segmented<Filter>
            size="sm"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setShown(PAGE);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "used", label: "Used" },
              { value: "added", label: "Added" },
            ]}
            className="self-start sm:self-auto"
          />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={<History size={20} strokeWidth={1.75} aria-hidden />}
          title={transactions.length === 0 ? "No activity yet" : filter === "used" ? "Nothing used yet" : "Nothing added yet"}
          description={
            transactions.length === 0
              ? "When you use an AI feature or receive credits, it will show up here."
              : "Try another filter to see the rest of your activity."
          }
        />
      ) : (
        <>
          <ul className="mt-4 divide-y divide-[rgba(20,20,20,0.06)]" aria-label="Credit transactions">
            {visible.map((tx) => {
              const plus = tx.amount > 0;
              return (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  <TxIcon tx={tx} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-orza-strong">{transactionLabel(tx.reason)}</div>
                    <div className="text-[12px] text-orza-subtle">
                      <time dateTime={tx.created_at}>{formatDateTime(tx.created_at)}</time>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div
                      className={cn("text-[15px] font-semibold tabular-nums", plus ? "text-[#127A56]" : tx.amount < 0 ? "text-[#C2410C]" : "text-orza-muted")}
                      aria-label={`${plus ? "Added" : "Used"} ${Math.abs(tx.amount)} credits`}
                    >
                      {plus ? "+" : tx.amount < 0 ? "−" : ""}
                      {formatNumber(Math.abs(tx.amount))}
                    </div>
                    <div className="text-[11px] tabular-nums text-orza-subtle">Balance {formatNumber(tx.balance_after)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(20,20,20,0.06)] pt-4">
            <span className="text-xs text-orza-subtle">
              Showing {visible.length} of {rows.length}
              {transactions.length >= 100 ? " · your latest 100 transactions" : ""}
            </span>
            {rows.length > shown && (
              <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                Show more
              </Button>
            )}
          </div>
        </>
      )}
    </GlassCard>
  );
}
