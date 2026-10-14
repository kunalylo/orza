"use client";
import * as React from "react";
import { PageHeader } from "@/components/app/ui";
import { Reveal } from "@/components/orza/Reveal";
import { AdjustCreditsDialog } from "@/components/account/admin/AdjustCreditsDialog";
import { UsersTable } from "@/components/account/admin/UsersTable";
import type { AdjustResponse, AdminUserRow } from "@/components/account/types";

/** Admin console — Members: search members (staff accounts are never listed) and adjust their credits. */
export default function AdminMembersPage() {
  const [target, setTarget] = React.useState<AdminUserRow | null>(null);
  const [adjusted, setAdjusted] = React.useState<{ userId: string; balance: number } | null>(null);

  function onAdjusted(userId: string, res: AdjustResponse) {
    setAdjusted({ userId, balance: res.balance });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin console"
        title="Members"
        description="Everyone using ÖRZA. Search by name or email and add or remove AI credits — members see the reason in their credit history."
      />
      <Reveal y={10}>
        <UsersTable refreshKey={0} onAdjust={setTarget} adjusted={adjusted} />
      </Reveal>
      <AdjustCreditsDialog target={target} onClose={() => setTarget(null)} onAdjusted={onAdjusted} />
    </div>
  );
}
