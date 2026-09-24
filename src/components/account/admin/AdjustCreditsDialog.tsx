"use client";
import * as React from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Segmented } from "@/components/ui/form";
import { ADJUST_LIMIT, ADJUST_REASON } from "@/components/account/options";
import { FieldError } from "@/components/account/ui";
import type { AdjustResponse, AdminUserRow } from "@/components/account/types";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatNumber } from "@/lib/utils";

type Mode = "add" | "remove";

const PRESETS = [10, 25, 50, 100, 250];
const REASONS = ["Credit request approved", "Thank-you for feedback", "Refund for a failed AI request", "Balance correction"];

const chip =
  "inline-flex h-8 items-center rounded-full border px-3 text-[13px] tabular-nums transition-colors duration-150 ease-orza";
const chipOff = "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-muted hover:bg-white hover:text-orza-strong";
const chipOn = "border-transparent bg-[#141414] text-orza-bg-0";

const cleanReason = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Grant or remove credits for one member. Mirrors the server rules: whole number 1–10,000,
 * reason 3–120 characters, and a balance that never goes below zero.
 */
export function AdjustCreditsDialog({
  target,
  onClose,
  onAdjusted,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
  onAdjusted: (userId: string, res: AdjustResponse) => void;
}) {
  // Keep the last member rendered while the dialog closes.
  const [member, setMember] = React.useState<AdminUserRow | null>(target);
  const [mode, setMode] = React.useState<Mode>("add");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<{ amount?: string; reason?: string; form?: string }>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    setMember(target);
    setMode("add");
    setAmount("");
    setReason("");
    setErrors({});
  }, [target]);

  const current = member?.credits ?? 0;
  const n = Number(amount);
  const valid = amount !== "" && Number.isInteger(n) && n > 0;
  const applied = !valid ? 0 : mode === "add" ? n : -Math.min(n, current);
  const next = current + applied;
  const capped = mode === "remove" && valid && n > current;

  function validate() {
    const errs: typeof errors = {};
    if (!amount) errs.amount = "Enter how many credits";
    else if (!valid) errs.amount = "Use a whole number above zero";
    else if (n > ADJUST_LIMIT) errs.amount = `At most ${formatNumber(ADJUST_LIMIT)} at a time`;
    else if (mode === "remove" && current <= 0) errs.amount = "This member has no credits to remove";
    const r = cleanReason(reason);
    if (r.length < ADJUST_REASON.min) errs.reason = `Add a short reason (at least ${ADJUST_REASON.min} characters)`;
    else if (r.length > ADJUST_REASON.max) errs.reason = `Keep it under ${ADJUST_REASON.max} characters`;
    return errs;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await api.post<AdjustResponse>(`/admin/credits/${encodeURIComponent(member.id)}/adjust`, {
        amount: mode === "add" ? n : -n,
        reason: cleanReason(reason),
      });
      const delta = res.transaction.amount;
      toast.success(delta >= 0 ? `Added ${formatNumber(delta)} credits` : `Removed ${formatNumber(-delta)} credits`, {
        description: `${member.name || member.email} now has ${formatNumber(res.balance)} credits.`,
      });
      onAdjusted(member.id, res);
      onClose();
    } catch (err) {
      setErrors({ form: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  const reasonLen = cleanReason(reason).length;

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        title="Adjust credits"
        description={member ? `For ${member.name || "this member"} · ${member.email}` : undefined}
      >
        {member && (
          <form onSubmit={submit} noValidate>
            <div role="group" aria-labelledby="adjust-mode-label">
              <div id="adjust-mode-label" className="sr-only">
                Add or remove credits
              </div>
              <Segmented<Mode>
                value={mode}
                onChange={(v) => {
                  setMode(v);
                  setErrors((x) => ({ ...x, amount: undefined, form: undefined }));
                }}
                options={[
                  {
                    value: "add",
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <Plus size={14} strokeWidth={2} aria-hidden /> Add
                      </span>
                    ),
                  },
                  {
                    value: "remove",
                    label: (
                      <span className="inline-flex items-center gap-1.5">
                        <Minus size={14} strokeWidth={2} aria-hidden /> Remove
                      </span>
                    ),
                  },
                ]}
                className="w-full [&>button]:flex-1"
              />
            </div>

            <div className="mt-5">
              <Label htmlFor="adjust-amount">Credits to {mode === "add" ? "add" : "remove"}</Label>
              <Input
                id="adjust-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^\d]/g, "").replace(/^0+/, "").slice(0, 5));
                  if (errors.amount || errors.form) setErrors((x) => ({ ...x, amount: undefined, form: undefined }));
                }}
                placeholder="e.g. 50"
                className="font-editorial text-[20px] font-semibold tabular-nums"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "adjust-amount-error" : undefined}
                autoFocus
              />
              <FieldError id="adjust-amount-error">{errors.amount}</FieldError>
              <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Quick amounts">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={amount === String(p)}
                    onClick={() => {
                      setAmount(String(p));
                      setErrors((x) => ({ ...x, amount: undefined, form: undefined }));
                    }}
                    className={cn(chip, amount === String(p) ? chipOn : chipOff)}
                  >
                    {mode === "add" ? "+" : "−"}
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <Label htmlFor="adjust-reason">Reason</Label>
              <Input
                id="adjust-reason"
                value={reason}
                maxLength={ADJUST_REASON.max + 20}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errors.reason || errors.form) setErrors((x) => ({ ...x, reason: undefined, form: undefined }));
                }}
                placeholder="Shown in the member's credit history"
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? "adjust-reason-error" : "adjust-reason-hint"}
              />
              {errors.reason ? (
                <FieldError id="adjust-reason-error">{errors.reason}</FieldError>
              ) : (
                <FieldHint id="adjust-reason-hint" className="flex justify-between gap-3">
                  <span>The member sees this reason next to the change.</span>
                  <span className={cn("tabular-nums", reasonLen > ADJUST_REASON.max && "text-[#B02C2C]")}>
                    {reasonLen}/{ADJUST_REASON.max}
                  </span>
                </FieldHint>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Suggested reasons">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={cleanReason(reason) === r}
                    onClick={() => {
                      setReason(r);
                      setErrors((x) => ({ ...x, reason: undefined, form: undefined }));
                    }}
                    className={cn(chip, "h-7 text-[12px]", cleanReason(reason) === r ? chipOn : chipOff)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Balance preview */}
            <div className="mt-6 flex items-center justify-between gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/70 px-4 py-3" aria-live="polite">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Balance</div>
                <div className="mt-0.5 flex items-center gap-2 font-editorial text-[22px] font-semibold tabular-nums text-orza-strong">
                  <span className={cn(valid && "text-orza-muted")}>{formatNumber(current)}</span>
                  {valid && (
                    <>
                      <ArrowRight size={16} strokeWidth={1.75} className="text-orza-subtle" aria-hidden />
                      <span className={applied >= 0 ? "text-[#127A56]" : "text-[#C2410C]"}>{formatNumber(next)}</span>
                    </>
                  )}
                </div>
              </div>
              {valid && (
                <span className={cn("text-[13px] font-medium tabular-nums", applied >= 0 ? "text-[#127A56]" : "text-[#C2410C]")}>
                  {applied >= 0 ? "+" : "−"}
                  {formatNumber(Math.abs(applied))}
                </span>
              )}
            </div>
            {capped && current > 0 && (
              <p className="mt-2 text-xs text-orza-subtle">Balances can&rsquo;t go below zero, so only {formatNumber(current)} will be removed.</p>
            )}

            {errors.form && (
              <p role="alert" className="mt-3 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
                {errors.form}
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button variant="ghost" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" variant={mode === "add" ? "primary" : "danger"} loading={saving}>
                {mode === "add" ? "Add credits" : "Remove credits"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
