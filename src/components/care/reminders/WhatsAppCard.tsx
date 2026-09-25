"use client";
import * as React from "react";
import { toast } from "sonner";
import { MessageCircle, Send } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Select } from "@/components/ui/form";
import { FieldError, SectionCard } from "@/components/account/ui";
import { COUNTRY_CODES, formatPhone, splitE164, toE164, type IntegrationsView } from "./shared";

export function WhatsAppCard({ integrations, onChange }: { integrations: IntegrationsView; onChange: (v: IntegrationsView) => void }) {
  const wa = integrations.whatsapp;
  const initial = splitE164(wa.phone);
  const [code, setCode] = React.useState(initial.code);
  const [national, setNational] = React.useState(initial.national);
  const [consent, setConsent] = React.useState(wa.opt_in);
  const [editing, setEditing] = React.useState(!wa.phone);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | "save" | "remove" | "test" | "pause">(null);
  const ids = React.useId();

  React.useEffect(() => {
    const s = splitE164(wa.phone);
    setCode(s.code);
    setNational(s.national);
    setConsent(wa.opt_in);
    setEditing(!wa.phone);
  }, [wa.phone, wa.opt_in]);

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    const parsed = toE164(national, code);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!consent) {
      setError("Tick the consent box so ÖRZA may message you on WhatsApp.");
      return;
    }
    setError(null);
    setBusy("save");
    try {
      const res = await api.put<IntegrationsView>("/integrations/whatsapp", { phone: parsed.e164, opt_in: true });
      onChange(res);
      toast.success("WhatsApp number saved");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const setOptIn = async (optIn: boolean) => {
    if (busy || !wa.phone) return;
    setBusy("pause");
    try {
      const res = await api.put<IntegrationsView>("/integrations/whatsapp", { phone: wa.phone, opt_in: optIn });
      onChange(res);
      toast(optIn ? "WhatsApp reminders are on" : "WhatsApp reminders are paused");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy("remove");
    try {
      const res = await api.put<IntegrationsView>("/integrations/whatsapp", { phone: null, opt_in: false });
      onChange(res);
      setNational("");
      setConsent(false);
      toast("WhatsApp number removed");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (busy) return;
    setBusy("test");
    try {
      const r = await api.post<{ ok: boolean; image: string; session_only: boolean }>("/integrations/whatsapp/test");
      toast.success(
        r.image && r.image !== "sent" && r.image !== "skipped"
          ? "Test message sent (the photo couldn't be attached)"
          : "Test message sent — check WhatsApp"
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const status = !wa.configured ? (
    <Tag tone="warning">Not connected</Tag>
  ) : wa.opt_in ? (
    <Tag tone="success">On</Tag>
  ) : wa.phone ? (
    <Tag tone="neutral">Paused</Tag>
  ) : (
    <Tag tone="neutral">Off</Tag>
  );

  return (
    <SectionCard
      id="whatsapp"
      icon={<MessageCircle size={18} strokeWidth={1.75} aria-hidden />}
      tone="cyan"
      eyebrow="Channel"
      title="WhatsApp"
      description="Get medicine alarms (with the photo) and the reminders you choose on WhatsApp."
      actions={status}
    >
      {!wa.configured && (
        <p className="mb-4 rounded-orza-sm border border-[rgba(176,106,0,0.2)] bg-[#FFF4E6] p-3.5 text-[13px] leading-relaxed text-[#7A4A00]">
          WhatsApp isn&apos;t connected by your ÖRZA admin yet. You can save your number now — messages start once it&apos;s connected.
        </p>
      )}

      {wa.phone && !editing ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/70 px-4 py-3">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Sending to</div>
              <div className="mt-0.5 text-[16px] font-medium tabular-nums text-orza-strong">{formatPhone(wa.phone)}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={!!busy}>
              Change
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa.opt_in ? (
              <>
                <Button variant="primary" onClick={test} loading={busy === "test"} disabled={!!busy || !wa.configured}>
                  {busy !== "test" && <Send size={15} aria-hidden />} Send test
                </Button>
                <Button variant="secondary" onClick={() => setOptIn(false)} loading={busy === "pause"} disabled={!!busy}>
                  Pause
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => setOptIn(true)} loading={busy === "pause"} disabled={!!busy}>
                Turn back on
              </Button>
            )}
            <Button variant="ghost" onClick={remove} loading={busy === "remove"} disabled={!!busy} className="text-[#B02C2C] hover:text-[#962424]">
              Remove number
            </Button>
          </div>
          {wa.configured && wa.mode === "session" && (
            <FieldHint className="leading-relaxed">
              WhatsApp only delivers ÖRZA&apos;s messages within 24 hours of your last message to ÖRZA&apos;s WhatsApp number. Send it a quick
              &ldquo;Hi&rdquo; each day, or use notifications as your main alarm.
            </FieldHint>
          )}
          <FieldHint className="leading-relaxed">
            Medicine alarms go to WhatsApp automatically. For meal, water and weigh-in reminders, switch on WhatsApp in each reminder.
          </FieldHint>
        </div>
      ) : (
        <form onSubmit={save} noValidate className="space-y-4">
          <div>
            <Label htmlFor={`${ids}-phone`}>WhatsApp number</Label>
            <div className="flex gap-2">
              <Select
                aria-label="Country code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-[128px] shrink-0 sm:w-[168px]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Input
                id={`${ids}-phone`}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
                value={national}
                onChange={(e) => {
                  setNational(e.target.value);
                  setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? `${ids}-err` : undefined}
                className="min-w-0 flex-1 tabular-nums"
              />
            </div>
            <FieldError id={`${ids}-err`}>{error}</FieldError>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-orza-muted">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                setError(null);
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#E0593F]"
            />
            <span>
              I agree to receive medicine alarms and reminders from ÖRZA on WhatsApp at this number. I can pause or remove it here any time.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" loading={busy === "save"}>
              Save number
            </Button>
            {wa.phone && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={!!busy}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}
    </SectionCard>
  );
}
