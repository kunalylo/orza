"use client";
import * as React from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldHint, Label, Textarea } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/utils";
import { CREDIT_REQUEST_MESSAGE_MAX as MAX } from "@/components/account/options";
import type { CreditRequestResponse, CreditRequestView } from "@/components/account/types";

/**
 * "Request more credits" — there's no payment gateway yet, so the request goes to the team from the
 * signed-in account (POST /api/credits/request, which records the email and balance server-side)
 * and they top the account up by hand.
 */
export function RequestCreditsDialog({
  open,
  onOpenChange,
  email,
  credits,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  credits: number;
  onSent: (request: CreditRequestView) => void;
}) {
  const [message, setMessage] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const note = message.trim();
    setSending(true);
    setError(null);
    try {
      const res = await api.post<CreditRequestResponse>("/credits/request", note ? { message: note } : {});
      toast.success("Request sent", { description: `Thanks! We'll reply to ${email} soon.` });
      setMessage("");
      onSent(res.request);
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent
        title="Request more credits"
        description="Online payments are coming soon. Tell us a little about how you use ÖRZA and the team will top up your credits."
      >
        <form onSubmit={submit} noValidate>
          <div className="flex items-center gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/70 px-3.5 py-3">
            <Mail size={16} strokeWidth={1.75} className="shrink-0 text-orza-muted" aria-hidden />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">We&rsquo;ll reply to</div>
              <div className="truncate text-[14px] text-orza-strong">{email}</div>
            </div>
            <div className="ml-auto shrink-0 text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Balance</div>
              <div className="text-[14px] tabular-nums text-orza-strong">{formatNumber(credits)}</div>
            </div>
          </div>

          <div className="mt-4">
            <Label htmlFor="credit-request-message">Message (optional)</Label>
            <Textarea
              id="credit-request-message"
              value={message}
              maxLength={MAX}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I scan most of my meals and chat with ÖRZA daily — could I get more credits?"
              aria-describedby="credit-request-hint"
            />
            <FieldHint id="credit-request-hint" className="flex justify-between gap-3">
              <span>Your email and current balance are included automatically.</span>
              <span className="tabular-nums">
                {message.length}/{MAX}
              </span>
            </FieldHint>
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" disabled={sending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={sending}>
              {!sending && <Send size={15} strokeWidth={1.75} aria-hidden />}
              Send request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
