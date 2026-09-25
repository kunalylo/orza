"use client";
import * as React from "react";
import { toast } from "sonner";
import { CalendarCheck2, CalendarPlus, CircleAlert, Link2Off, Lock, RefreshCw } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Eyebrow, GlassCard, IconTile, Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { FieldHint, Input, Label, Segmented, Skeleton } from "@/components/ui/form";
import type { ExternalCalendarState, ExternalConnectResponse } from "./types";

type Provider = "google" | "apple" | "outlook";

const PROVIDER_NAME: Record<NonNullable<ExternalCalendarState["provider"]>, string> = {
  google: "Google Calendar",
  apple: "Apple iCloud Calendar",
  outlook: "Outlook Calendar",
  other: "Calendar",
};

const GUIDES: Record<Provider, { steps: React.ReactNode[]; note: string }> = {
  google: {
    steps: [
      <>
        On a computer, open <span className="font-medium text-orza-strong">calendar.google.com</span> and go to{" "}
        <span className="font-medium text-orza-strong">Settings</span> (the gear icon).
      </>,
      <>
        Under <span className="font-medium text-orza-strong">Settings for my calendars</span>, choose your calendar, then{" "}
        <span className="font-medium text-orza-strong">Integrate calendar</span>.
      </>,
      <>
        Copy the <span className="font-medium text-orza-strong">Secret address in iCal format</span> and paste it below.
      </>,
    ],
    note: "The secret address lets anyone who has it read that calendar. ÖRZA only reads it, and you can reset it in Google at any time.",
  },
  apple: {
    steps: [
      <>
        On iPhone, open <span className="font-medium text-orza-strong">Calendar</span>, tap{" "}
        <span className="font-medium text-orza-strong">Calendars</span>, then the <span className="font-medium text-orza-strong">ⓘ</span> next to
        your iCloud calendar.
      </>,
      <>
        Turn on <span className="font-medium text-orza-strong">Public Calendar</span> and tap{" "}
        <span className="font-medium text-orza-strong">Share Link… → Copy</span>. (On iCloud.com: Calendar → share icon → Public Calendar → Copy
        Link.)
      </>,
      <>Paste the link below — webcal:// links work as they are.</>,
    ],
    note: "A public calendar link can be viewed by anyone who has it. Turn Public Calendar off in Apple Calendar to stop sharing.",
  },
  outlook: {
    steps: [
      <>
        In Outlook on the web, open <span className="font-medium text-orza-strong">Settings → Calendar → Shared calendars</span>.
      </>,
      <>
        Under <span className="font-medium text-orza-strong">Publish a calendar</span>, pick your calendar and a permission (“Can view all
        details” or “Can view when I&apos;m busy”), then <span className="font-medium text-orza-strong">Publish</span>.
      </>,
      <>
        Copy the <span className="font-medium text-orza-strong">ICS</span> link and paste it below.
      </>,
    ],
    note: "With “Can view when I'm busy”, ÖRZA still sees busy times for busy-day insights, without event titles.",
  },
};

/** "Connect your calendar" — read-only import of the user's own Google / iCloud / Outlook calendar. */
export function ConnectCard({
  external,
  loading,
  onChange,
}: {
  external: ExternalCalendarState;
  loading: boolean;
  onChange: (state: ExternalCalendarState) => void;
}) {
  const [provider, setProvider] = React.useState<Provider>(
    external.provider && external.provider !== "other" ? external.provider : "google"
  );
  const [editing, setEditing] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [lastCount, setLastCount] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Show the matching guide once the saved connection's provider is known.
  React.useEffect(() => {
    if (external.provider && external.provider !== "other") setProvider(external.provider);
  }, [external.provider]);

  const showForm = !external.connected || editing;

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = url.trim();
    if (!value) {
      setError("Paste your calendar's iCal (ICS) address first.");
      inputRef.current?.focus();
      return;
    }
    if (!/^(https|webcals?):\/\//i.test(value)) {
      setError("Calendar links start with https:// or webcal://. Copy the full address from your calendar's settings.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<ExternalConnectResponse>("/calendar/external", { url: value });
      onChange(res.external);
      setLastCount(res.upcoming_count);
      setEditing(false);
      setUrl("");
      toast.success(
        res.upcoming_count
          ? `Calendar connected — ${res.upcoming_count} event${res.upcoming_count === 1 ? "" : "s"} in the next 30 days.`
          : "Calendar connected. It has no events in the next 30 days yet."
      );
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      toast.error(msg);
      inputRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setRemoving(true);
    try {
      await api.del("/calendar/external");
      onChange({ connected: false });
      setConfirmRemove(false);
      setLastCount(null);
      toast.success("Calendar disconnected. ÖRZA no longer reads it.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const guide = GUIDES[provider];

  return (
    <GlassCard as="section" id="connect-calendar" aria-labelledby="connect-heading" className="flex scroll-mt-24 flex-col">
      <div className="flex items-start gap-3">
        <IconTile tone="violet">
          <CalendarPlus size={18} strokeWidth={1.75} aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <Eyebrow>Your calendar</Eyebrow>
          <h2 id="connect-heading" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
            Connect your calendar
          </h2>
        </div>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-orza-muted">
        See your meetings next to doses and meals, and let ÖRZA flag busy days so you can plan food around them. Read-only — ÖRZA never
        changes your calendar.
      </p>

      {loading ? (
        <div className="mt-5 space-y-3" aria-hidden>
          <Skeleton className="h-8 w-64 !rounded-full" />
          <Skeleton className="h-20 w-full !rounded-orza-sm" />
          <Skeleton className="h-11 w-full !rounded-orza-sm" />
        </div>
      ) : (
        <>
          {external.connected && !editing && (
            <div className="mt-5 rounded-orza-sm border border-[rgba(18,122,86,0.22)] bg-[#F1FAF6] p-4">
              <div className="flex items-start gap-3">
                <CalendarCheck2 size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[#127A56]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium text-orza-strong">{PROVIDER_NAME[external.provider || "other"]}</span>
                    <Tag tone={external.error ? "warning" : "success"} size="sm">
                      {external.error ? "Needs attention" : "Connected"}
                    </Tag>
                  </div>
                  {external.name && <div className="mt-0.5 text-[13px] text-orza-muted">“{external.name}”</div>}
                  {external.url_preview && (
                    <div className="mt-1 flex items-center gap-1.5 break-all font-mono text-[12px] text-orza-subtle">
                      <Lock size={11} strokeWidth={1.75} aria-hidden className="shrink-0" />
                      {external.url_preview}
                    </div>
                  )}
                  {lastCount !== null && !external.error && (
                    <div className="mt-1.5 text-[13px] text-[#127A56]">
                      {lastCount} event{lastCount === 1 ? "" : "s"} in the next 30 days
                    </div>
                  )}
                </div>
              </div>
              {external.error && (
                <p role="alert" className="mt-3 flex gap-2 rounded-[10px] bg-[#FFF4E6] p-2.5 text-[13px] leading-5 text-[#7A4A00]">
                  <CircleAlert size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    {external.error} Your ÖRZA doses, reminders and meals still show as usual.
                  </span>
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    setError(null);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  <RefreshCw size={14} strokeWidth={1.75} aria-hidden /> Replace link
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} className="text-[#B02C2C] hover:text-[#962424]">
                  <Link2Off size={14} strokeWidth={1.75} aria-hidden /> Disconnect
                </Button>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-orza-subtle">ÖRZA re-reads your calendar at most every 10 minutes while you use this page.</p>
            </div>
          )}

          {showForm && (
            <div className="mt-5">
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <Segmented<Provider> aria-label="Your calendar app"
                  size="sm"
                  value={provider}
                  onChange={setProvider}
                  options={[
                    { value: "google", label: "Google" },
                    { value: "apple", label: "Apple iCloud" },
                    { value: "outlook", label: "Outlook" },
                  ]}
                />
              </div>
              <ol className="mt-4 space-y-2.5" aria-label={`How to find your ${PROVIDER_NAME[provider]} link`}>
                {guide.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-[13px] leading-5 text-orza-muted">
                    <span
                      aria-hidden
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 font-mono text-[11px] text-orza-strong shadow-orza-glass"
                    >
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[12px] leading-5 text-orza-subtle">{guide.note}</p>

              <form onSubmit={connect} className="mt-4" noValidate>
                <Label htmlFor="external-url">Calendar address (iCal / ICS)</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="external-url"
                    ref={inputRef}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="https://… or webcal://…"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? "external-url-error" : "external-url-hint"}
                    className="min-w-0 font-mono text-[13px]"
                  />
                  <div className="flex shrink-0 gap-2">
                    <Button type="submit" variant="primary" loading={saving} className="h-11 flex-1 sm:flex-none">
                      {saving ? "Checking…" : "Connect"}
                    </Button>
                    {editing && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11"
                        onClick={() => {
                          setEditing(false);
                          setUrl("");
                          setError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
                {error ? (
                  <p id="external-url-error" role="alert" className="mt-2 flex gap-1.5 text-[13px] leading-5 text-[#B02C2C]">
                    <CircleAlert size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
                    {error}
                  </p>
                ) : (
                  <FieldHint id="external-url-hint">ÖRZA checks the link once before saving. It stays private and is never shown in full again.</FieldHint>
                )}
              </form>
            </div>
          )}
        </>
      )}

      <Dialog open={confirmRemove} onOpenChange={(o) => !o && !removing && setConfirmRemove(false)}>
        <DialogContent
          title="Disconnect your calendar?"
          description="ÖRZA will stop reading it and forget the link. Your calendar itself isn't changed. You can connect it again any time."
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" disabled={removing}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="danger" onClick={disconnect} loading={removing}>
              Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}
