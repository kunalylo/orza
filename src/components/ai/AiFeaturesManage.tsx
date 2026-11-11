"use client";
import * as React from "react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { formatDate } from "@/components/account/ui";
import { Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { hasAiConsent } from "@/lib/ai-consent-shared";
import { api } from "@/lib/api-client";
import type { PublicUser } from "@/lib/types";
import { allowAiFeatures, consentErrorLine } from "./AiConsentProvider";
import { ConsentDetails, ConsentTitle } from "./ConsentDetails";
import { AI_SETTINGS, consentLead } from "./copy";

/**
 * Settings → Preferences → AI features: "Manage" opens the status, what is sent and one button — Allow AI features
 * (it saves the consent itself, no second dialog) or Turn off AI features (after a confirm). The record is the
 * account's, so the phone app follows it too.
 */
export function AiFeaturesManage() {
  const { user, setUser } = useUser();
  const allowed = hasAiConsent(user);
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setConfirming(false);
      setError(null);
    }
  }, [open]);

  async function save(change: () => Promise<PublicUser>, done: string) {
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
      setError(consentErrorLine(e));
    } finally {
      setSaving(false);
    }
  }

  const turnOff = () => api.del<{ user: PublicUser }>("/settings/ai-consent").then((r) => r.user);
  const status = allowed && user.ai_consent ? `On since ${formatDate(user.ai_consent.at)}` : "Off";

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label="Manage AI features">
        {AI_SETTINGS.manage}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
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
                    <Button variant="energy" onClick={() => void save(allowAiFeatures, AI_SETTINGS.onToast)} loading={saving}>
                      {AI_SETTINGS.allow}
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
