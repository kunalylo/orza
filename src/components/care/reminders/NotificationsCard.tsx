"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellOff, BellRing, Info, Send, Share, Smartphone, SquarePlus } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Tag } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/account/ui";
import {
  detectPushSupport,
  currentSubscription,
  notificationPermission,
  subscribePush,
  subscriptionBody,
  unsubscribePush,
  type PermissionState,
  type PushSupport,
} from "./push-client";
import type { IntegrationsView } from "./shared";

type TestResult = { sent: number; failed: number; removed: number; errors: string[] };

export function NotificationsCard({
  push,
  onSubscriptionsChange,
}: {
  push: IntegrationsView["push"];
  onSubscriptionsChange: (n: number) => void;
}) {
  const [support, setSupport] = React.useState<PushSupport | null>(null);
  const [permission, setPermission] = React.useState<PermissionState>("default");
  const [endpoint, setEndpoint] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | "enable" | "disable" | "test">(null);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || push.public_key || "";

  // Detect support + this browser's subscription; re-sync it to the server so it never silently drifts.
  React.useEffect(() => {
    let cancelled = false;
    const s = detectPushSupport();
    setSupport(s);
    setPermission(notificationPermission());
    if (!s.supported) return;
    void (async () => {
      const sub = await currentSubscription();
      if (cancelled) return;
      setEndpoint(sub?.endpoint || null);
      if (sub && Notification.permission === "granted" && push.configured) {
        try {
          const res = await api.post<{ subscriptions: number }>("/push/subscribe", subscriptionBody(sub));
          if (!cancelled) onSubscriptionsChange(res.subscriptions);
        } catch {
          /* shown on the next action */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [push.configured]);

  const enable = async () => {
    if (busy) return;
    if (!publicKey) {
      toast.error("Notifications aren't available right now. Alarms still ring in any open ÖRZA tab.");
      return;
    }
    setBusy("enable");
    try {
      const sub = await subscribePush(publicKey);
      setPermission(notificationPermission());
      const res = await api.post<{ subscriptions: number }>("/push/subscribe", subscriptionBody(sub));
      setEndpoint(sub.endpoint);
      onSubscriptionsChange(res.subscriptions);
      toast.success("Notifications are on for this device");
    } catch (e) {
      setPermission(notificationPermission());
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    if (busy) return;
    setBusy("disable");
    try {
      const old = await unsubscribePush();
      if (old) {
        const res = await api.post<{ subscriptions: number }>("/push/unsubscribe", { endpoint: old });
        onSubscriptionsChange(res.subscriptions);
      }
      setEndpoint(null);
      toast("Notifications are off for this device");
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
      const r = await api.post<TestResult>("/push/test", endpoint ? { endpoint } : {});
      if (r.sent > 0) toast.success("Test sent — it should appear in a few seconds");
      else toast.error(r.errors[0] || "The test couldn't be delivered.");
      if (r.removed) {
        setEndpoint(null);
        onSubscriptionsChange(Math.max(0, push.subscriptions - r.removed));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const loading = support === null;
  const on = !!endpoint && permission === "granted";
  const blocked = permission === "denied";
  const ios = support?.ios;
  const needsInstall = support?.blocker === "ios-install";

  let status: React.ReactNode;
  if (loading) status = null;
  else if (!push.configured) status = <Tag tone="neutral">Unavailable</Tag>;
  else if (on) status = <Tag tone="success">On for this device</Tag>;
  else if (blocked) status = <Tag tone="danger">Blocked</Tag>;
  else if (!support?.supported) status = <Tag tone="neutral">{needsInstall ? "Install first" : "Not supported"}</Tag>;
  else status = <Tag tone="neutral">Off</Tag>;

  return (
    <SectionCard
      id="notifications"
      icon={<BellRing size={18} strokeWidth={1.75} aria-hidden />}
      tone="energy"
      eyebrow="This device"
      title="Notifications"
      description="Medicine alarms arrive with the medicine's photo and Take / Snooze buttons — even when ÖRZA is closed."
      actions={status}
    >
      {loading ? (
        <div className="orza-skeleton h-11 w-48 rounded-full" aria-hidden />
      ) : !push.configured ? (
        <Notice>
          Notifications aren&apos;t available right now. Alarms still ring in any open ÖRZA tab, and the calendar feed below can ring your phone.
        </Notice>
      ) : needsInstall ? (
        <IphoneSteps emphasised />
      ) : !support?.supported ? (
        <Notice>
          {support?.blocker === "insecure"
            ? "Notifications need a secure (https) connection to ÖRZA."
            : "This browser can't show web notifications. Try Chrome, Edge, Firefox or Safari (on iPhone: add ÖRZA to your Home Screen)."}
        </Notice>
      ) : (
        <div className="space-y-4">
          {blocked && (
            <Notice tone="danger">
              Notifications are blocked for ÖRZA. Open your browser&apos;s site settings (the icon left of the address), allow Notifications,
              then reload this page.
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {on ? (
              <>
                <Button variant="primary" onClick={test} loading={busy === "test"} disabled={!!busy}>
                  {busy !== "test" && <Send size={15} aria-hidden />} Send test
                </Button>
                <Button variant="ghost" onClick={disable} loading={busy === "disable"} disabled={!!busy}>
                  {busy !== "disable" && <BellOff size={15} aria-hidden />} Turn off on this device
                </Button>
              </>
            ) : (
              <Button variant="energy" size="lg" onClick={enable} loading={busy === "enable"} disabled={!!busy || blocked}>
                {busy !== "enable" && <BellRing size={17} aria-hidden />} Enable notifications
              </Button>
            )}
          </div>
          <p className="text-[13px] text-orza-muted">
            {push.subscriptions === 0
              ? "No device has notifications on yet. Turn them on for every phone and computer you use."
              : `Notifications are on for ${push.subscriptions} ${push.subscriptions === 1 ? "device" : "devices"}.`}
          </p>
          {ios && !support?.standalone && <IphoneSteps />}
        </div>
      )}

      <div className="mt-5 flex gap-2.5 rounded-orza-sm border border-[rgba(11,143,166,0.18)] bg-[#EAF6FF]/70 p-3.5 text-[13px] leading-relaxed text-orza-muted">
        <Info size={16} className="mt-0.5 shrink-0 text-[#0B8FA6]" aria-hidden />
        <p>
          ÖRZA is a web app, so it can&apos;t set your phone&apos;s built-in alarm clock. Alarms reach you through notifications (allowed on
          this device) or a full-screen alarm while an ÖRZA tab is open. For a ring that doesn&apos;t depend on either, add the{" "}
          <Link href="/dashboard/calendar" className="font-medium text-[#0B8FA6] underline-offset-2 hover:underline">
            ÖRZA calendar feed
          </Link>{" "}
          to your phone&apos;s calendar.
        </p>
      </div>
    </SectionCard>
  );
}

function Notice({ children, tone = "warning" }: { children: React.ReactNode; tone?: "warning" | "danger" }) {
  return (
    <p
      role={tone === "danger" ? "alert" : undefined}
      className={
        tone === "danger"
          ? "rounded-orza-sm border border-[rgba(176,44,44,0.2)] bg-[#FDECEC] p-3.5 text-[13px] leading-relaxed text-[#8A2323]"
          : "rounded-orza-sm border border-[rgba(176,106,0,0.2)] bg-[#FFF4E6] p-3.5 text-[13px] leading-relaxed text-[#7A4A00]"
      }
    >
      {children}
    </p>
  );
}

/** iPhone / iPad: web push only works for sites added to the Home Screen (iOS 16.4+). */
function IphoneSteps({ emphasised }: { emphasised?: boolean }) {
  const steps = [
    { icon: Share, text: <>In Safari, tap the <strong className="font-medium text-orza-strong">Share</strong> button.</> },
    { icon: SquarePlus, text: <>Choose <strong className="font-medium text-orza-strong">Add to Home Screen</strong>, then Add.</> },
    { icon: Smartphone, text: <>Open ÖRZA from the new icon, come back to Reminders and tap <strong className="font-medium text-orza-strong">Enable notifications</strong>.</> },
  ];
  return (
    <div className={emphasised ? "rounded-orza-sm border border-[rgba(255,122,106,0.28)] bg-[#FFF1EA]/70 p-4" : "rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60 p-4"}>
      <div className="text-[14px] font-medium text-orza-strong">On iPhone or iPad</div>
      <p className="mt-0.5 text-[13px] text-orza-muted">Apple only allows notifications for web apps on the Home Screen (iOS 16.4 or later).</p>
      <ol className="mt-3 space-y-2.5">
        {steps.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-start gap-3 text-[13px] leading-relaxed text-orza-muted">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(20,20,20,0.10)] bg-white text-orza-strong">
              <Icon size={14} aria-hidden />
            </span>
            <span className="pt-1">
              <span className="sr-only">Step {i + 1}: </span>
              {text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
