"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Download, LogOut, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/form";
import { SectionCard } from "@/components/account/ui";
import { api } from "@/lib/api-client";

const CONFIRM_WORD = "DELETE";

const WHAT_GETS_DELETED = [
  "Your profile, targets, preferences and everything ÖRZA remembers",
  "Every meal, photo scan, water, step and weight entry",
  "Chats, goals, rebalance plans and saved recipes",
  "Your AI credits, credit history and credit requests",
];

/** DELETE /api/account needs a JSON body, which the shared api client's `del` doesn't send. */
async function deleteAccount() {
  const res = await fetch("/api/account", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: CONFIRM_WORD }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "We couldn't delete your account. Please try again.");
  }
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [typed, setTyped] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const ready = typed.trim() === CONFIRM_WORD;

  React.useEffect(() => {
    if (!open) {
      setTyped("");
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      toast.success("Your account has been deleted", { description: "Thank you for trying ÖRZA. Take care." });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !deleting && onOpenChange(o)}>
      <DialogContent title="Delete your account?" description="This permanently removes your ÖRZA account. It can't be undone.">
        <form onSubmit={submit} noValidate>
          <ul className="space-y-2 rounded-orza-sm border border-[rgba(176,44,44,0.18)] bg-[#FDECEC]/60 p-4 text-[13px] leading-snug text-orza-strong">
            {WHAT_GETS_DELETED.map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#B02C2C]" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-orza-muted">Want a copy first? Close this and use &ldquo;Export my data&rdquo;.</p>

          <div className="mt-5">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono tracking-[0.08em]">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={CONFIRM_WORD}
              aria-invalid={!!error}
              aria-describedby={error ? "delete-error" : undefined}
            />
          </div>
          {error && (
            <p id="delete-error" role="alert" className="mt-3 rounded-orza-xs bg-[#FDECEC] px-3 py-2 text-[13px] text-[#B02C2C]">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" disabled={deleting}>
                Keep my account
              </Button>
            </DialogClose>
            <Button type="submit" variant="danger" loading={deleting} disabled={!ready}>
              Delete forever
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Privacy & data — export everything, delete the account, sign out. */
export function PrivacySection() {
  const { user } = useUser();
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  function exportData() {
    setExporting(true);
    toast("Preparing your data…", { description: "Your download will start in a moment." });
    window.location.href = "/api/account/export";
    // A file download doesn't navigate away, so just release the button shortly after.
    setTimeout(() => setExporting(false), 2500);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post("/auth/logout");
    } catch {
      /* the session cookie is cleared server-side; go home either way */
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <SectionCard
      id="privacy"
      icon={<ShieldCheck size={18} strokeWidth={1.75} aria-hidden />}
      tone="cyan"
      eyebrow="Privacy & data"
      title="Your data, your call"
      description="Your data is stored securely. We never share personal health information without your consent."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 p-4">
          <div className="text-[14px] font-medium text-orza-strong">Export my data</div>
          <p className="mt-1 flex-1 text-[13px] leading-relaxed text-orza-muted">
            Download everything ÖRZA stores about you — profile, meals, chats, goals, recipes and credit history — as a JSON file.
          </p>
          <Button variant="secondary" size="sm" className="mt-4 self-start" onClick={exportData} loading={exporting}>
            {!exporting && <Download size={14} strokeWidth={1.75} aria-hidden />}
            Export my data
          </Button>
        </div>
        <div className="flex flex-col rounded-orza-sm border border-[rgba(176,44,44,0.20)] bg-[#FDECEC]/40 p-4">
          <div className="flex items-center gap-1.5 text-[14px] font-medium text-[#B02C2C]">
            <TriangleAlert size={15} strokeWidth={1.75} aria-hidden /> Delete account
          </div>
          <p className="mt-1 flex-1 text-[13px] leading-relaxed text-orza-muted">
            Permanently delete your account and all of your data. This can&rsquo;t be undone.
          </p>
          <Button variant="danger" size="sm" className="mt-4 self-start" onClick={() => setDeleteOpen(true)}>
            Delete account…
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
        <Link href="/privacy" className="inline-flex items-center gap-1 font-medium text-orza-strong underline-offset-4 hover:underline">
          Privacy policy <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
        </Link>
        <Link href="/trust" className="inline-flex items-center gap-1 font-medium text-orza-strong underline-offset-4 hover:underline">
          Trust &amp; safety <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-[rgba(20,20,20,0.08)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-[13px] text-orza-muted">
          Signed in as <span className="break-all font-medium text-orza-strong">{user.email}</span>
        </p>
        <Button variant="secondary" onClick={signOut} loading={signingOut} className="self-start sm:self-auto">
          {!signingOut && <LogOut size={15} strokeWidth={1.75} aria-hidden />}
          Sign out
        </Button>
      </div>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </SectionCard>
  );
}
