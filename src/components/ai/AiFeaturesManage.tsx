"use client";
import * as React from "react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { formatDate } from "@/components/account/ui";
import { Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { hasAiConsent } from "@/lib/ai-consent-shared";
import { api } from "@/lib/api-client";
import type { PublicUser } from "@/lib/types";
import { allowAiFeatures, consentErrorLine, isAccountChanged } from "./AiConsentProvider";
import { ConsentDetails, ConsentTitle } from "./ConsentDetails";
import { AI_SETTINGS, consentLead } from "./copy";

/**
 * Settings → Preferences → AI features: "Manage" opens the status, what is sent and one button — Allow AI features
 * (it saves the consent itself, no second dialog) or Turn off AI features (after a confirm). The record is the
 * account's, so the phone app follows it too. `describedBy`: the row's status line, read with the button.
 */
export function AiFeaturesManage({ describedBy }: { describedBy?: string }) {
  const { user, setUser } = useUser();
  const allowed = hasAiConsent(user);
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /** Bumped by every save, so a status read that started before it can't undo it. */
  const saves = React.useRef(0);

  React.useEffect(() => {
    if (!open) {
      setConfirming(false);
      setError(null);
      return;
    }
    // The status as the account has it now: a choice made in the app or another tab since this page loaded.
    let live = true;
    const before = saves.current;
    api
      .get<{ user: PublicUser }>("/auth/me")
      .then((r) => {
        if (live && before === saves.current && r?.user) setUser((cur) => (r.user.id === cur.id ? r.user : cur));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, setUser]);

  async function save(change: () => Promise<PublicUser>, done: string) {
    saves.current++;
    setSaving(true);
    setError(null);
    try {
      const u = await change();
      // Another account signed in in this browser meanwhile: show that account.
      if (u.id !== user.id) {
        window.location.reload();
        return;
      }
      setUser(u);
      setOpen(false);
      toast.success(done);
    } catch (e) {
      // Allow refused because another account signed in in this browser meanwhile (nothing recorded): show that account.
      if (isAccountChanged(e)) {
        window.location.reload();
        return;
      }
      setError(consentErrorLine(e));
    } finally {
      setSaving(false);
    }
  }

  const turnOff = () => api.del<{ user: PublicUser }>("/settings/ai-consent").then((r) => r.user);
  const status = allowed && user.ai_consent ? `On since ${formatDate(user.ai_consent.at)}` : "Off";

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
      {/* A trigger, so focus comes back to it when the dialog closes. */}
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" aria-label="Manage AI features" aria-describedby={describedBy}>
          {AI_SETTINGS.manage}
        </Button>
      </DialogTrigger>
      {open && (
        <DialogContent
          title={<ConsentTitle eyebrow={AI_SETTINGS.eyebrow} title={confirming ? AI_SETTINGS.confirmTitle : AI_SETTINGS.title} />}
          description={confirming ? AI_SETTINGS.confirmBody : consentLead("settings")}
          // The dialog itself takes focus (its title and lead are read first), not the privacy link in the list.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
        >
          {confirming ? (
            <>
              {error && (
                <p role="alert" className="mb-4 text-[13px] leading-relaxed text-[#B02C2C]">
                  {error}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {/* Focus moves here from the button the confirm replaced; Keep on closes the dialog. */}
                <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving} autoFocus>
                  {AI_SETTINGS.cancel}
                </Button>
                <Button variant="danger" onClick={() => void save(turnOff, AI_SETTINGS.offToast)} loading={saving}>
                  {AI_SETTINGS.confirm}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Tag tone={allowed ? "success" : "neutral"} className="mb-4">
                {status}
              </Tag>
              <ConsentDetails context="settings" />
              {error && (
                <p role="alert" className="mt-4 text-[13px] leading-relaxed text-[#B02C2C]">
                  {error}
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[rgba(20,20,20,0.08)] pt-4 sm:flex-row sm:justify-end">
                {allowed ? (
                  <Button variant="secondary" onClick={() => setConfirming(true)}>
                    {AI_SETTINGS.turnOff}
                  </Button>
                ) : (
                  <Button variant="energy" onClick={() => void save(() => allowAiFeatures(user.id), AI_SETTINGS.onToast)} loading={saving}>
                    {AI_SETTINGS.allow}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
