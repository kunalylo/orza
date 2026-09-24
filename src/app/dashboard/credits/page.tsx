"use client";
import * as React from "react";
import { useUser } from "@/components/app/UserProvider";
import { PageHeader } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";
import { Skeleton } from "@/components/ui/form";
import { BalanceHero } from "@/components/account/credits/BalanceHero";
import { CostsCard } from "@/components/account/credits/CostsCard";
import { PlansPreview } from "@/components/account/credits/PlansPreview";
import { RequestCreditsDialog } from "@/components/account/credits/RequestCreditsDialog";
import { TransactionHistory } from "@/components/account/credits/TransactionHistory";
import { LoadError } from "@/components/account/ui";
import type { BalanceResponse, TransactionsResponse } from "@/components/account/types";
import { api, errorMessage } from "@/lib/api-client";
import type { CreditTransaction } from "@/lib/types";

function CreditsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading credits">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
        <Skeleton className="h-[420px] rounded-orza-xl" />
        <Skeleton className="h-[420px] rounded-orza-md" />
      </div>
      <Skeleton className="mt-10 h-8 w-72" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-orza-md" />
        ))}
      </div>
      <Skeleton className="mt-10 h-72 rounded-orza-md" />
    </div>
  );
}

/** AI credits: balance, what each AI action costs, plan preview, and the credit history. */
export default function CreditsPage() {
  const { user, setCredits } = useUser();
  const [balance, setBalance] = React.useState<BalanceResponse | null>(null);
  const [transactions, setTransactions] = React.useState<CreditTransaction[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [requested, setRequested] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [b, t] = await Promise.all([
        api.get<BalanceResponse>("/credits/balance"),
        api.get<TransactionsResponse>("/credits/transactions"),
      ]);
      setBalance(b);
      setTransactions(t.transactions || []);
      setCredits(b.credits); // keep the sidebar pill in sync
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [setCredits]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="AI credits"
        title="Credits"
        description="Credits power ÖRZA's AI — photo scans, AI meal logging, chat, recipes and rebalance plans. Everything else is free, always."
      />

      {error && !balance ? (
        <LoadError
          title="We couldn’t load your credits"
          message={error}
          onRetry={() => {
            setError(null);
            load();
          }}
        />
      ) : !balance ? (
        <CreditsSkeleton />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:gap-6">
            <Reveal y={10} className="h-full">
              <BalanceHero
                credits={balance.credits}
                costs={balance.costs}
                aiEnabled={balance.ai_enabled}
                spent30d={balance.spent_30d}
                requested={requested}
                onRequest={() => setRequestOpen(true)}
              />
            </Reveal>
            <Reveal delay={0.06} className="h-full">
              <CostsCard costs={balance.costs} aiEnabled={balance.ai_enabled} />
            </Reveal>
          </div>

          <PlansPreview className="mt-12" requested={requested} onRequest={() => setRequestOpen(true)} />

          <Reveal className="mt-12">
            <TransactionHistory transactions={transactions} />
          </Reveal>

          <RequestCreditsDialog
            open={requestOpen}
            onOpenChange={setRequestOpen}
            email={user.email}
            credits={balance.credits}
            onSent={() => setRequested(true)}
          />
        </>
      )}
    </div>
  );
}
