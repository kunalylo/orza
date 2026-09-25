"use client";
import * as React from "react";
import { toast } from "sonner";
import { MoonStar } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { FieldHint, Label } from "@/components/ui/form";
import { FieldError, SectionCard, Switch } from "@/components/account/ui";
import { isHHMM, type IntegrationsView } from "./shared";

const DEFAULT_QUIET = { start: "22:30", end: "07:00" };

export function QuietHoursCard({ integrations, onChange }: { integrations: IntegrationsView; onChange: (v: IntegrationsView) => void }) {
  const saved = integrations.quiet_hours;
  const [enabled, setEnabled] = React.useState(!!saved);
  const [start, setStart] = React.useState(saved?.start || DEFAULT_QUIET.start);
  const [end, setEnd] = React.useState(saved?.end || DEFAULT_QUIET.end);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const ids = React.useId();

  React.useEffect(() => {
    setEnabled(!!saved);
    if (saved) {
      setStart(saved.start);
      setEnd(saved.end);
    }
  }, [saved]);

  const persist = async (next: { start: string; end: string } | null) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.put<IntegrationsView>("/integrations/quiet-hours", next ? next : { start: null, end: null });
      onChange(res);
      toast.success(next ? `Quiet hours set: ${next.start} – ${next.end}` : "Quiet hours turned off");
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (v: boolean) => {
    if (busy) return;
    setEnabled(v);
    if (v) {
      const ok = await persist({ start, end });
      if (!ok) setEnabled(false);
    } else if (saved) {
      const ok = await persist(null);
      if (!ok) setEnabled(true);
    }
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    if (!isHHMM(start) || !isHHMM(end)) return setError("Choose both a start and an end time.");
    if (start === end) return setError("Start and end need to be different times.");
    await persist({ start, end });
  };

  const dirty = !!saved && (saved.start !== start || saved.end !== end);

  return (
    <SectionCard
      id="quiet-hours"
      icon={<MoonStar size={18} strokeWidth={1.75} aria-hidden />}
      tone="violet"
      eyebrow="Do not disturb"
      title="Quiet hours"
      description={`No notifications or WhatsApp messages during these hours (your time, ${integrations.timezone.replace(/_/g, " ")}). An open ÖRZA tab stays silent too.`}
      actions={
        <Switch checked={enabled} onCheckedChange={toggle} disabled={busy} aria-label="Quiet hours" />
      }
    >
      {enabled ? (
        <form onSubmit={save} noValidate className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor={`${ids}-start`}>From</Label>
              <input
                id={`${ids}-start`}
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11 rounded-orza-sm border border-[rgba(20,20,20,0.12)] bg-white/80 px-3 text-[15px] tabular-nums text-orza-strong focus:border-orza-cyan focus:outline-none focus:shadow-[0_0_0_3px_rgba(11,190,220,0.18)]"
              />
            </div>
            <div>
              <Label htmlFor={`${ids}-end`}>Until</Label>
              <input
                id={`${ids}-end`}
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="h-11 rounded-orza-sm border border-[rgba(20,20,20,0.12)] bg-white/80 px-3 text-[15px] tabular-nums text-orza-strong focus:border-orza-cyan focus:outline-none focus:shadow-[0_0_0_3px_rgba(11,190,220,0.18)]"
              />
            </div>
            {(dirty || !saved) && (
              <Button type="submit" variant="primary" loading={busy}>
                Save
              </Button>
            )}
          </div>
          <FieldError>{error}</FieldError>
          <FieldHint className="leading-relaxed">
            Medicine doses that fall inside quiet hours won&apos;t notify you — keep your dose times outside this window. Refill alerts wait until
            quiet hours end.
          </FieldHint>
        </form>
      ) : error ? (
        <FieldError>{error}</FieldError>
      ) : null}
    </SectionCard>
  );
}
