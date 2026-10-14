"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellPlus, CalendarDays, ChevronRight, Clock3, Info, MessageCircle, Pencil, Pill, Plus, ScanLine, Smartphone } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { GlassCard, IconTile, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { LoadError, SectionCard, Switch } from "@/components/account/ui";
import type { PublicUser } from "@/lib/types";
import { NotificationsCard } from "./NotificationsCard";
import { QuietHoursCard } from "./QuietHoursCard";
import { KIND_ICON, ReminderSheet } from "./ReminderSheet";
import { WhatsAppCard } from "./WhatsAppCard";
import {
  DEFAULT_CHANNELS,
  KIND_LABEL,
  MAX_REMINDERS,
  REMINDER_PRESETS,
  describeNext,
  describeSchedule,
  type IntegrationsView,
  type ReminderPreset,
  type ReminderView,
} from "./shared";

export function RemindersSkeleton() {
  return (
    <div aria-busy aria-label="Loading reminders">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="h-[220px] w-full !rounded-orza-md" />
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[360px] w-full !rounded-orza-md lg:col-span-7" />
        <Skeleton className="h-[360px] w-full !rounded-orza-md lg:col-span-5" />
      </div>
    </div>
  );
}

const sameTimes = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((t, i) => t === [...b].sort()[i]);

export function RemindersView() {
  const { setUser } = useUser();
  const [integrations, setIntegrations] = React.useState<IntegrationsView | null>(null);
  const [reminders, setReminders] = React.useState<ReminderView[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sheet, setSheet] = React.useState<{ open: boolean; reminder: ReminderView | null }>({ open: false, reminder: null });
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [resuming, setResuming] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [i, r] = await Promise.all([
        api.get<IntegrationsView>("/integrations"),
        api.get<{ reminders: ReminderView[] }>("/reminders"),
      ]);
      setIntegrations(i);
      setReminders(r.reminders);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (error && (!integrations || !reminders)) {
    return (
      <>
        <Header onNew={() => undefined} disabled />
        <LoadError title="Couldn't load your reminders" message={error} onRetry={load} />
      </>
    );
  }
  if (!integrations || !reminders) return <RemindersSkeleton />;

  const tz = integrations.timezone;
  // WhatsApp only appears once the service is connected on the server; until then it's hidden everywhere.
  const whatsappAvailable = integrations.whatsapp.configured;
  const whatsappReady = whatsappAvailable && integrations.whatsapp.opt_in;
  const pushReady = integrations.push.subscriptions > 0;

  const upsert = (r: ReminderView) =>
    setReminders((list) => {
      const rest = (list || []).filter((x) => x.id !== r.id);
      return [...rest, r].sort(
        (a, b) => Number(b.active) - Number(a.active) || (a.schedule.times[0] || "").localeCompare(b.schedule.times[0] || "") || a.title.localeCompare(b.title)
      );
    });

  const toggleActive = async (r: ReminderView, active: boolean) => {
    if (pending[r.id]) return;
    setPending((p) => ({ ...p, [r.id]: true }));
    upsert({ ...r, active });
    try {
      const res = await api.patch<{ reminder: ReminderView }>(`/reminders/${r.id}`, { active });
      upsert(res.reminder);
    } catch (e) {
      upsert(r);
      toast.error(errorMessage(e));
    } finally {
      setPending((p) => ({ ...p, [r.id]: false }));
    }
  };

  const addPreset = async (p: ReminderPreset) => {
    const key = `preset:${p.key}`;
    if (pending[key]) return;
    setPending((x) => ({ ...x, [key]: true }));
    try {
      const res = await api.post<{ reminder: ReminderView }>("/reminders", {
        kind: p.kind,
        title: p.title,
        ...(p.body ? { body: p.body } : {}),
        schedule: { times: p.times, days: p.days },
        channels: { ...DEFAULT_CHANNELS, whatsapp: whatsappReady && p.kind !== "water" },
      });
      upsert(res.reminder);
      toast.success(`Added “${p.label}”`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending((x) => ({ ...x, [key]: false }));
    }
  };

  const resumeGentle = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      const res = await api.put<{ user: PublicUser }>("/settings/preferences", { reminders: true });
      setUser(res.user);
      setIntegrations((i) => (i ? { ...i, reminders_enabled: true } : i));
      toast.success("Gentle reminders are back on");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setResuming(false);
    }
  };

  const presetAdded = (p: ReminderPreset) => reminders.some((r) => r.kind === p.kind && r.title === p.title && sameTimes(r.schedule.times, p.times));
  const openNew = () => setSheet({ open: true, reminder: null });
  const atLimit = reminders.length >= MAX_REMINDERS;

  return (
    <div>
      <Header onNew={openNew} disabled={atLimit} />

      {!integrations.reminders_enabled && (
        <div
          role="status"
          className="mb-6 flex flex-col gap-3 rounded-orza-md border border-[rgba(176,106,0,0.22)] bg-[#FFF4E6] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-[14px] leading-relaxed text-[#7A4A00]">
            Meal, water and weigh-in reminders are paused (Settings → Gentle reminders). Medicine alarms still ring.
          </p>
          <Button variant="primary" size="sm" onClick={resumeGentle} loading={resuming} className="shrink-0">
            Turn reminders back on
          </Button>
        </div>
      )}

      <Reveal>
        <NotificationsCard
          push={integrations.push}
          onSubscriptionsChange={(n) => setIntegrations((i) => (i ? { ...i, push: { ...i.push, subscriptions: n } } : i))}
        />
      </Reveal>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Reveal>
            <SectionCard
              id="reminders"
              icon={<Clock3 size={18} strokeWidth={1.75} aria-hidden />}
              eyebrow={`${reminders.filter((r) => r.active).length} active`}
              title="Your reminders"
              description="Nudges to log meals, drink water and weigh in. Times follow your timezone."
              actions={
                <Button variant="secondary" size="sm" onClick={openNew} disabled={atLimit}>
                  <Plus size={14} aria-hidden /> Add
                </Button>
              }
            >
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">One-tap presets</div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {REMINDER_PRESETS.map((p) => {
                    const added = presetAdded(p);
                    const Icon = KIND_ICON[p.kind];
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => addPreset(p)}
                        disabled={added || !!pending[`preset:${p.key}`] || atLimit}
                        aria-label={added ? `${p.label} (${p.hint}) — already added` : `Add ${p.label} (${p.hint})`}
                        className={cn(
                          "group inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-left text-[13px] transition-colors duration-150 ease-orza",
                          added
                            ? "border-[rgba(18,122,86,0.22)] bg-[#EAF7F1] text-[#127A56]"
                            : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-strong hover:border-[rgba(255,122,106,0.4)] hover:bg-white",
                          "disabled:cursor-default"
                        )}
                      >
                        <Icon size={14} aria-hidden className={added ? "" : "text-[#E0593F]"} />
                        <span className="font-medium">{p.label}</span>
                        <span className={added ? "text-[#127A56]/80" : "text-orza-subtle"}>{added ? "Added" : p.hint}</span>
                        {!added && <Plus size={13} aria-hidden className="text-orza-subtle group-hover:text-orza-strong" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6">
                {reminders.length === 0 ? (
                  <EmptyState
                    icon={<BellPlus size={20} strokeWidth={1.75} aria-hidden />}
                    title="No reminders yet"
                    description="Tap a preset above, or create your own — ÖRZA will nudge you right on time."
                    action={
                      <Button variant="primary" onClick={openNew}>
                        <Plus size={15} aria-hidden /> New reminder
                      </Button>
                    }
                  />
                ) : (
                  <ul className="divide-y divide-[rgba(20,20,20,0.07)] rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/60">
                    {reminders.map((r) => (
                      <ReminderRow
                        key={r.id}
                        reminder={r}
                        tz={tz}
                        whatsapp={whatsappAvailable}
                        busy={!!pending[r.id]}
                        onToggle={(v) => toggleActive(r, v)}
                        onEdit={() => setSheet({ open: true, reminder: r })}
                      />
                    ))}
                  </ul>
                )}
                {atLimit && <p className="mt-3 text-[13px] text-orza-muted">You&apos;ve reached {MAX_REMINDERS} reminders — delete one to add another.</p>}
              </div>
            </SectionCard>
          </Reveal>

          <Reveal>
            <MedicinesCard />
          </Reveal>
        </div>

        <div className="space-y-6 lg:col-span-5">
          {whatsappAvailable && (
            <Reveal>
              <WhatsAppCard integrations={integrations} onChange={setIntegrations} />
            </Reveal>
          )}
          <Reveal>
            <QuietHoursCard integrations={integrations} onChange={setIntegrations} />
          </Reveal>
          <Reveal>
            <DeliveryHelp whatsapp={whatsappAvailable} />
          </Reveal>
        </div>
      </div>

      <ReminderSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        reminder={sheet.reminder}
        whatsappAvailable={whatsappAvailable}
        whatsappReady={whatsappReady}
        pushReady={pushReady}
        onSaved={(r) => upsert(r)}
        onDeleted={(id) => setReminders((list) => (list || []).filter((x) => x.id !== id))}
      />
    </div>
  );
}

function Header({ onNew, disabled }: { onNew: () => void; disabled?: boolean }) {
  return (
    <PageHeader
      eyebrow="Care · Reminders"
      title="Reminders & alarms"
      description="Gentle nudges for meals, water and weigh-ins — and medicine alarms that show a photo of every medicine, so there's never a mix-up."
      actions={
        <Button variant="primary" onClick={onNew} disabled={disabled}>
          <Plus size={16} aria-hidden /> New reminder
        </Button>
      }
    />
  );
}

function ChannelTags({ r, whatsapp }: { r: ReminderView; whatsapp: boolean }) {
  const items = [
    r.channels.push && { key: "push", label: "App", icon: Smartphone },
    whatsapp && r.channels.whatsapp && { key: "wa", label: "WhatsApp", icon: MessageCircle },
    r.channels.calendar && { key: "cal", label: "Calendar", icon: CalendarDays },
  ].filter(Boolean) as { key: string; label: string; icon: React.ElementType }[];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {items.map(({ key, label, icon: Icon }) => (
        <span key={key} className="inline-flex items-center gap-1 rounded-full bg-[rgba(20,20,20,0.05)] px-2 py-0.5 text-[11px] text-orza-muted">
          <Icon size={11} aria-hidden /> {label}
        </span>
      ))}
    </span>
  );
}

function ReminderRow({
  reminder: r,
  tz,
  whatsapp,
  busy,
  onToggle,
  onEdit,
}: {
  reminder: ReminderView;
  tz: string;
  whatsapp: boolean;
  busy: boolean;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
}) {
  const Icon = KIND_ICON[r.kind];
  const titleId = `rem-${r.id}-title`;
  const next = r.active ? describeNext(r.next_at, tz) : "";
  return (
    <li className={cn("flex items-center gap-3 px-3.5 py-3.5 sm:px-4", !r.active && "opacity-60")}>
      <IconTile tone={r.active ? "energy" : "neutral"} className="h-9 w-9">
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </IconTile>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 rounded-orza-xs text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan">
        <span id={titleId} className="block truncate text-[15px] font-medium text-orza-strong">
          {r.title}
        </span>
        <span className="mt-0.5 block text-[13px] text-orza-muted">
          <span className="sr-only">{KIND_LABEL[r.kind]} reminder, </span>
          {describeSchedule(r.schedule)}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <ChannelTags r={r} whatsapp={whatsapp} />
          {next && <span className="text-[12px] text-orza-subtle">Next: {next}</span>}
          {!r.active && <span className="text-[12px] text-orza-subtle">Paused</span>}
          {r.active && !r.next_at && <span className="text-[12px] text-orza-subtle">Schedule ended</span>}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${r.title}`}
          className="hidden h-9 w-9 items-center justify-center rounded-full text-orza-muted hover:bg-white hover:text-orza-strong sm:inline-flex"
        >
          <Pencil size={15} aria-hidden />
        </button>
        <Switch checked={r.active} onCheckedChange={onToggle} disabled={busy} aria-labelledby={titleId} />
      </div>
    </li>
  );
}

function MedicinesCard() {
  return (
    <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-[220px] w-[220px] rounded-full"
        style={{ background: "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.28) 0%, rgba(255,95,162,0.10) 45%, rgba(0,0,0,0) 70%)", filter: "blur(6px)" }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <IconTile tone="energy" className="mt-0.5">
            <Pill size={18} strokeWidth={1.75} aria-hidden />
          </IconTile>
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-muted">Medicine alarms</div>
            <h2 className="mt-1 font-editorial text-[22px] font-semibold leading-7 text-orza-strong">Set up in Medicines</h2>
            <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-orza-muted">
              Each medicine rings at its own times with its photo. Scan a prescription and ÖRZA creates the alarms for you.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <ButtonLink href="/dashboard/medicines" variant="primary" size="sm">
            Open Medicines <ChevronRight size={14} aria-hidden />
          </ButtonLink>
          <ButtonLink href="/dashboard/medicines/prescriptions" variant="secondary" size="sm">
            <ScanLine size={14} aria-hidden /> Scan a prescription
          </ButtonLink>
        </div>
      </div>
    </GlassCard>
  );
}

function DeliveryHelp({ whatsapp }: { whatsapp: boolean }) {
  return (
    <SectionCard
      id="delivery"
      icon={<Info size={18} strokeWidth={1.75} aria-hidden />}
      eyebrow="How it works"
      title="When reminders arrive"
      description="ÖRZA checks for due alarms every minute, so a notification can arrive up to a minute after its time."
    >
      <ul className="space-y-2.5 text-[13px] leading-relaxed text-orza-muted">
        <li className="flex gap-2">
          <Tag tone="energy" size="sm" dot={false}>App</Tag>
          <span>Notifications on each device where you enabled them, plus a full-screen alarm in any open ÖRZA tab.</span>
        </li>
        {whatsapp && (
          <li className="flex gap-2">
            <Tag tone="info" size="sm" dot={false}>WhatsApp</Tag>
            <span>Messages from ÖRZA&apos;s WhatsApp number, with the medicine photo.</span>
          </li>
        )}
        <li className="flex gap-2">
          <Tag tone="violet" size="sm" dot={false}>Calendar</Tag>
          <span>
            Events with alerts in your phone&apos;s calendar via the{" "}
            <Link href="/dashboard/calendar" className="font-medium text-[#0B8FA6] hover:underline">
              calendar feed
            </Link>
            .
          </span>
        </li>
      </ul>
    </SectionCard>
  );
}
