"use client";
import * as React from "react";
import { toast } from "sonner";
import { AlarmClock, Check, Copy, ExternalLink, KeyRound, Link2, RefreshCw, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Eyebrow, GlassCard, IconTile } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Skeleton } from "@/components/ui/form";
import type { CalendarFeedLinks, CalendarTokenResponse } from "./types";

export const googleSubscribeUrl = (webcal: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
export const outlookSubscribeUrl = (feed: string) =>
  `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feed)}&name=${encodeURIComponent("ÖRZA")}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure contexts: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const PROVIDER_STEPS: { key: string; name: string; steps: string }[] = [
  {
    key: "google",
    name: "Google Calendar",
    steps:
      "Opens Google Calendar with the link filled in — choose Add. Google ignores alerts inside subscribed calendars, so open Settings, pick the ÖRZA calendar under Other calendars and add an event notification at 0 minutes. Google refreshes subscriptions every few hours, so new medicines can take a while to appear there.",
  },
  {
    key: "apple",
    name: "Apple Calendar",
    steps:
      "On iPhone, iPad or Mac, tap the button and choose Subscribe. Turn off Remove Alerts so doses ring. On a Mac, set Auto-refresh to Every hour in the calendar's Get Info panel.",
  },
  {
    key: "outlook",
    name: "Outlook",
    steps:
      "Opens Outlook on the web with the link filled in — choose Import. In the Outlook app, use Add calendar → Subscribe from web and paste the link. Outlook refreshes subscriptions every few hours, and some versions don't pop up alerts for them.",
  },
];

/** Subscribe card: private ICS feed of doses + reminders (with alarms) for Google / Apple / Outlook. */
export function SubscribeCard({
  feed,
  isLocal,
  loading,
  onChange,
}: {
  feed: CalendarFeedLinks | null;
  isLocal: boolean;
  loading: boolean;
  onChange: (feed: CalendarFeedLinks | null, isLocal?: boolean) => void;
}) {
  const [busy, setBusy] = React.useState<"create" | "rotate" | "revoke" | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [confirm, setConfirm] = React.useState<"rotate" | "revoke" | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const create = async (mode: "create" | "rotate") => {
    setBusy(mode);
    try {
      const res = await api.post<CalendarTokenResponse>("/calendar/token");
      onChange({ feed_url: res.feed_url, webcal_url: res.webcal_url }, res.is_local);
      setConfirm(null);
      toast.success(mode === "rotate" ? "New link created. The old one has stopped working — subscribe again with this one." : "Your calendar link is ready.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async () => {
    setBusy("revoke");
    try {
      await api.del("/calendar/token");
      onChange(null);
      setConfirm(null);
      toast.success("Calendar link turned off. Subscribed calendars will stop updating.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!feed) return;
    if (await copyText(feed.feed_url)) {
      setCopied(true);
      toast.success("Link copied");
    } else {
      inputRef.current?.select();
      toast.error("Couldn't copy automatically — the link is selected, copy it from there.");
    }
  };

  return (
    <GlassCard as="section" aria-labelledby="subscribe-heading" className="flex flex-col">
      <div className="flex items-start gap-3">
        <IconTile tone="energy">
          <AlarmClock size={18} strokeWidth={1.75} aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <Eyebrow>Calendar feed</Eyebrow>
          <h2 id="subscribe-heading" className="mt-1 font-editorial text-[22px] font-semibold leading-7 tracking-[-0.01em] text-orza-strong">
            Get dose alarms in your phone&apos;s calendar
          </h2>
        </div>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-orza-muted">
        Subscribe once and every medicine dose — plus reminders you&apos;ve added to the calendar — appears as an event with an alert, so your
        phone&apos;s calendar can ring at dose time even when ÖRZA isn&apos;t open. Each event links to the alarm page with the medicine&apos;s photos.
      </p>

      {loading ? (
        <div className="mt-5 space-y-3" aria-hidden>
          <Skeleton className="h-11 w-full !rounded-orza-sm" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-40 !rounded-full" />
            <Skeleton className="h-9 w-32 !rounded-full" />
          </div>
        </div>
      ) : !feed ? (
        <div className="mt-5">
          <Button variant="primary" onClick={() => create("create")} loading={busy === "create"}>
            <Link2 size={16} strokeWidth={1.75} aria-hidden /> Create my calendar link
          </Button>
          <p className="mt-3 text-[12px] leading-5 text-orza-subtle">
            The link is private to you. You can replace it or turn it off at any time.
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <Label htmlFor="feed-url">Your private calendar link</Label>
          <div className="flex gap-2">
            <Input
              id="feed-url"
              ref={inputRef}
              readOnly
              value={feed.feed_url}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 font-mono text-[13px]"
              aria-describedby="feed-privacy"
            />
            <Button variant="secondary" size="icon" onClick={copy} aria-label={copied ? "Link copied" : "Copy calendar link"} className="h-11 w-11 shrink-0">
              {copied ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={1.75} aria-hidden />}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={googleSubscribeUrl(feed.webcal_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-full bg-[#141414] px-4 text-[13px] font-medium text-orza-bg-0 shadow-orza-cta transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan focus-visible:ring-offset-2"
            >
              Add to Google Calendar <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <a
              href={feed.webcal_url}
              className="inline-flex h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-full border border-[rgba(20,20,20,0.12)] bg-white/70 px-4 text-[13px] font-medium text-orza-strong transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan focus-visible:ring-offset-2"
            >
              Apple Calendar
            </a>
            <a
              href={outlookSubscribeUrl(feed.feed_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-full items-center justify-center sm:w-auto gap-1.5 rounded-full border border-[rgba(20,20,20,0.12)] bg-white/70 px-4 text-[13px] font-medium text-orza-strong transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan focus-visible:ring-offset-2"
            >
              Outlook <ExternalLink size={13} strokeWidth={1.75} aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>

          <dl className="mt-4 space-y-2.5">
            {PROVIDER_STEPS.map((p) => (
              <div key={p.key} className="text-[13px] leading-5">
                <dt className="font-medium text-orza-strong">{p.name}</dt>
                <dd className="text-orza-muted">{p.steps}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {isLocal && !loading && (
        <div role="note" className="mt-4 flex gap-2.5 rounded-orza-sm border border-[rgba(176,106,0,0.22)] bg-[#FFF4E6] p-3 text-[13px] leading-5 text-[#7A4A00]">
          <TriangleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {feed ? (
              <>
                This link points to <span className="font-mono">{hostOf(feed.feed_url)}</span>, which only this computer can reach.
              </>
            ) : (
              <>ÖRZA is running on this computer (localhost).</>
            )}{" "}
            Google, Apple and Outlook fetch the calendar from the internet, so subscribing works once ÖRZA is deployed at its public address.
          </span>
        </div>
      )}

      {feed && !loading && (
        <div className="mt-auto pt-5">
          <p id="feed-privacy" className="flex gap-2 text-[12px] leading-5 text-orza-subtle">
            <ShieldAlert size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
            Anyone with this link can see your medicine names and times. Keep it to yourself — if it&apos;s shared by mistake, replace it.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirm("rotate")} disabled={!!busy}>
              <RefreshCw size={14} strokeWidth={1.75} aria-hidden /> Replace link
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm("revoke")} disabled={!!busy} className="text-[#B02C2C] hover:text-[#962424]">
              <Trash2 size={14} strokeWidth={1.75} aria-hidden /> Turn off
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <DialogContent
          title={confirm === "rotate" ? "Replace your calendar link?" : "Turn off your calendar link?"}
          description={
            confirm === "rotate"
              ? "ÖRZA will create a new private link. The current link stops working straight away, so calendars subscribed to it stop updating until you subscribe again with the new one."
              : "Calendars subscribed to this link will stop updating, and dose alarms from ÖRZA will no longer appear in them. You can create a new link later."
          }
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="ghost" disabled={!!busy}>
                Cancel
              </Button>
            </DialogClose>
            {confirm === "rotate" ? (
              <Button variant="primary" onClick={() => create("rotate")} loading={busy === "rotate"}>
                <KeyRound size={15} strokeWidth={1.75} aria-hidden /> Replace link
              </Button>
            ) : (
              <Button variant="danger" onClick={revoke} loading={busy === "revoke"}>
                Turn off link
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}

