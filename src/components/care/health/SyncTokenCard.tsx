"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { GlassCard, IconTile, Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/form";
import { CopyButton, CopyField } from "./HealthUi";
import { formatDay } from "./format";
import type { HealthTokenCreated, HealthTokenStatus } from "./metrics";

type Status = HealthTokenStatus["token"];

/**
 * Personal sync token for automation apps, Shortcuts and (later) the ÖRZA mobile app.
 * The plaintext is shown once after creation; afterwards only its last four characters.
 */
export function SyncTokenCard({
  status,
  loading,
  freshToken,
  syncUrl,
  onCreated,
  onRevoked,
  onDismissFresh,
}: {
  status: Status;
  loading: boolean;
  freshToken: string | null;
  syncUrl: string;
  onCreated: (created: HealthTokenCreated) => void;
  onRevoked: () => void;
  onDismissFresh: () => void;
}) {
  const [busy, setBusy] = React.useState<"create" | "revoke" | null>(null);
  const [confirm, setConfirm] = React.useState<"rotate" | "revoke" | null>(null);

  const create = async () => {
    setBusy("create");
    try {
      const res = await api.post<HealthTokenCreated>("/health/token");
      onCreated(res);
      setConfirm(null);
      toast.success(status ? "New sync token created — the old one no longer works." : "Sync token created. Copy it now.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    try {
      await api.del("/health/token");
      onRevoked();
      setConfirm(null);
      toast.success("Sync token revoked. Apps using it can no longer send data.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassCard variant="strong" className="scroll-mt-24" id="sync-token">
      <div className="flex items-start gap-3">
        <IconTile tone="violet">
          <KeyRound className="h-5 w-5" aria-hidden />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">Your sync token</h3>
            {!loading && (status ? <Tag tone="success">Active</Tag> : <Tag tone="neutral">Not created</Tag>)}
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-orza-muted">
            Apps and Shortcuts on your phone use this token to send daily totals to your account. It can only add health data — it
            can&apos;t read anything from ÖRZA. Keep it private, like a password.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <Skeleton className="h-[72px] w-full !rounded-orza-sm" />
        ) : freshToken ? (
          <div className="rounded-orza-sm border border-[rgba(255,122,106,0.35)] bg-[#FFF6F1] p-3.5">
            <div className="flex items-start gap-2 text-[13px] leading-5 text-[#9A3412]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Copy this token now. For your security ÖRZA shows it only once — if you lose it, create a new one.</span>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 break-all rounded-orza-xs bg-white px-3 py-2 font-mono text-[13px] leading-5 text-orza-strong" aria-label="Your new sync token">
                {freshToken}
              </code>
              <CopyButton text={freshToken} label="sync token" className="self-start sm:self-center" />
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={onDismissFresh}>
                I&apos;ve saved it — hide
              </Button>
            </div>
          </div>
        ) : status ? (
          <div className="flex flex-col gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-[#127A56]" aria-hidden />
              <div>
                <div className="font-mono text-[13px] text-orza-strong">orza_hs_••••••••{status.preview}</div>
                {status.created_at && <div className="text-[12px] text-orza-subtle">Created {formatDay(status.created_at.slice(0, 10), true)}</div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirm("rotate")}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Replace
              </Button>
              <Button size="sm" variant="ghost" className="text-[#B02C2C] hover:bg-[#FDECEC] hover:text-[#962424]" onClick={() => setConfirm("revoke")}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Revoke
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-orza-sm border border-dashed border-[rgba(20,20,20,0.14)] bg-white/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13.5px] text-orza-muted">Create a token to connect Health Auto Export, a Shortcut or an Android automation app.</p>
            <Button size="sm" onClick={create} loading={busy === "create"}>
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              Create sync token
            </Button>
          </div>
        )}
        <CopyField label="Sync URL" value={syncUrl} />
      </div>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && busy === null && setConfirm(null)}>
        {confirm && (
          <DialogContent
            title={confirm === "rotate" ? "Replace your sync token?" : "Revoke your sync token?"}
            description={
              confirm === "rotate"
                ? "ÖRZA will create a new token and the current one stops working immediately. Update every app or Shortcut that uses it."
                : "Apps and Shortcuts using this token will stop syncing straight away. Health data already in ÖRZA stays."
            }
          >
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="secondary" disabled={busy !== null}>
                  Cancel
                </Button>
              </DialogClose>
              {confirm === "rotate" ? (
                <Button onClick={create} loading={busy === "create"}>
                  Create new token
                </Button>
              ) : (
                <Button variant="danger" onClick={revoke} loading={busy === "revoke"}>
                  Revoke token
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </GlassCard>
  );
}
