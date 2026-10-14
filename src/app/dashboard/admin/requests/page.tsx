"use client";
import * as React from "react";
import { PageHeader } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";
import { AdjustCreditsDialog } from "@/components/account/admin/AdjustCreditsDialog";
import { CreditRequestsCard } from "@/components/account/admin/CreditRequestsCard";
import type { AdjustResponse, AdminUserRow } from "@/components/account/types";

/** Admin console — Credit requests: open "Request more credits" messages, top up or mark done. */
export default function AdminRequestsPage() {
  const [target, setTarget] = React.useState<AdminUserRow | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  function onAdjusted(_userId: string, res: AdjustResponse) {
    // A grant closes the member's open requests on the server; reload so they leave the list.
    if (res.requests_closed) setRefreshKey((k) => k + 1);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin console"
        title="Credit requests"
        description="Members ask for more AI credits from their Credits page. Top up to answer (that closes their open requests), or mark a request done if you replied another way."
      />
      <Reveal y={10}>
        <CreditRequestsCard refreshKey={refreshKey} onTopUp={setTarget} />
      </Reveal>
      <AdjustCreditsDialog target={target} onClose={() => setTarget(null)} onAdjusted={onAdjusted} />
    </div>
  );
}
