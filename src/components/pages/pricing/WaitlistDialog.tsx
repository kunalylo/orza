"use client";
import * as React from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api-client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Join the waitlist" for a Premium plan. Payments aren't live yet, so instead of a checkout the
 * visitor leaves an email, stored through /api/leads with source `plan:<id>` (deduped per plan).
 */
export function WaitlistDialog({
  plan,
  onOpenChange,
  onJoined,
}: {
  /** The plan being joined; `null` closes the dialog. */
  plan: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onJoined: (planId: string) => void;
}) {
  const [email, setEmail] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const open = plan !== null;

  React.useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.post("/leads", { email: value, source: `plan:${plan.id}` });
      toast.success("You're on the waitlist", { description: `We'll email ${value} when ${plan.name} opens.` });
      onJoined(plan.id);
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
        title={plan ? `Join the ${plan.name} waitlist` : "Join the waitlist"}
        description="Premium plans are launching soon. Leave your email and we'll let you know the moment you can upgrade. Nothing is charged today."
      >
        <form onSubmit={submit} noValidate>
          <Label htmlFor="waitlist-email">Email</Label>
          <Input
            id="waitlist-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "waitlist-error" : "waitlist-hint"}
          />
          {error ? (
            <p id="waitlist-error" role="alert" className="mt-3 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
              {error}
            </p>
          ) : (
            <FieldHint id="waitlist-hint">We&rsquo;ll only use it to tell you about this plan. No spam.</FieldHint>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" disabled={sending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={sending}>
              {!sending && <BellRing size={15} strokeWidth={1.75} aria-hidden />}
              Notify me
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
