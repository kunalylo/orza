"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, BellRing, CalendarDays, ChevronRight, MessageCircle, Pill, Plus, RefreshCw, ScanLine, Smartphone } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { DEFAULT_TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { GlassCard, IconTile } from "@/components/orza/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/form";
import { AdherenceStrip } from "./AdherenceStrip";
import { MedicineCard } from "./MedicineCard";
import { MedicineSheet } from "./MedicineSheet";
import { TimelineSkeleton, TodayTimeline } from "./TodayTimeline";
import { useDoseActions, useDoseUpdates } from "./useDoseActions";
import {
  formatDateShort,
  needsRefill,
  todayIn,
  type AdherenceResponse,
  type DoseItem,
  type MedicationClient,
  type TodayResponse,
} from "./shared";

type Load<T> = { data: T | null; loading: boolean; error: string | null };

function useLoad<T>(path: string) {
  const [state, setState] = React.useState<Load<T>>({ data: null, loading: true, error: null });
  const reload = React.useCallback(
    async (silent = false) => {
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await api.get<T>(path);
        setState({ data, loading: false, error: null });
        return data;
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: silent && s.data ? s.error : errorMessage(e) }));
        return null;
      }
    },
    [path]
  );
  React.useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload, setData: (fn: (d: T | null) => T | null) => setState((s) => ({ ...s, data: fn(s.data) })) };
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-orza-md border border-[rgba(176,44,44,0.18)] bg-[#FDF3F3] p-4 text-sm text-[#8A2323] sm:flex-row sm:items-center sm:justify-between" role="alert">
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} aria-hidden /> {message}
      </span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw size={14} aria-hidden /> Try again
      </Button>
    </div>
  );
}

/** Suspense fallback (the view reads ?add / ?edit). */
export function MedicinesSkeleton() {
  return (
    <div aria-busy aria-label="Loading medicines">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <Skeleton className="mb-6 h-24 w-full !rounded-orza-md" />
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="h-[360px] w-full !rounded-orza-md" />
        <Skeleton className="h-[260px] w-full !rounded-orza-md" />
      </div>
    </div>
  );
}

/** /dashboard/medicines — today's doses, 7-day adherence, the medicine list and the add/edit sheet. */
export function MedicinesView() {
  const { user } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [today, setToday] = React.useState(() => todayIn(tz));

  const meds = useLoad<{ medications: MedicationClient[] }>("/meds");
  const todayRes = useLoad<TodayResponse>(`/meds/today?date=${today}`);
  const adherence = useLoad<AdherenceResponse>("/meds/adherence?days=7");

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MedicationClient | null>(null);
  const [person, setPerson] = React.useState<string>("all");

  const medsList = React.useMemo(() => meds.data?.medications ?? [], [meds.data]);
  const people = React.useMemo(() => [...new Set(medsList.map((m) => m.for_person).filter((p): p is string => !!p))].sort(), [medsList]);

  // Keep statuses fresh (due → missed, snooze ending) and roll over at local midnight.
  const reloadToday = todayRes.reload;
  const reloadAdherence = adherence.reload;
  React.useEffect(() => {
    const t = setInterval(() => {
      const now = todayIn(tz);
      if (now !== today) setToday(now);
      else if (document.visibilityState === "visible") reloadToday(true);
    }, 60000);
    return () => clearInterval(t);
  }, [tz, today, reloadToday]);
  const firstDay = React.useRef(today);
  React.useEffect(() => {
    if (firstDay.current !== today) reloadAdherence(true);
  }, [today, reloadAdherence]);

  // Deep links: ?add=1 opens the add sheet, ?edit=<id> opens that medicine.
  const deepLinkHandled = React.useRef<string | null>(null);
  React.useEffect(() => {
    const add = params.get("add");
    const edit = params.get("edit");
    const key = `${add}|${edit}`;
    if ((!add && !edit) || deepLinkHandled.current === key) return;
    if (edit && !meds.data) return; // wait for the list
    deepLinkHandled.current = key;
    if (edit) {
      const m = medsList.find((x) => x.id === edit);
      if (m) {
        setEditing(m);
        setSheetOpen(true);
      }
    } else {
      setEditing(null);
      setSheetOpen(true);
    }
    router.replace(pathname, { scroll: false });
  }, [params, meds.data, medsList, router, pathname]);

  const { act, pendingFor } = useDoseActions({
    tz,
    onDone: (updated) => {
      todayRes.setData((d) =>
        d
          ? { ...d, doses: d.doses.map((x) => (x.medication_id === updated.medication_id && x.scheduled_for === updated.scheduled_for ? updated : x)) }
          : d
      );
      // Stock goes down on "take" (today + adherence refresh via the dose-updated event).
      meds.reload(true);
    },
  });

  // A dose handled in the alarm overlay or from a notification: refresh quietly.
  useDoseUpdates(() => {
    reloadToday(true);
    reloadAdherence(true);
  });

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (m: MedicationClient) => {
    setEditing(m);
    setSheetOpen(true);
  };

  const onSaved = (m: MedicationClient) => {
    meds.setData((d) => {
      const list = d?.medications ?? [];
      const exists = list.some((x) => x.id === m.id);
      const next = exists ? list.map((x) => (x.id === m.id ? { ...x, ...m } : x)) : [...list, m];
      next.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
      return { medications: next };
    });
    todayRes.reload(true);
    adherence.reload(true);
  };
  const onDeleted = (id: string) => {
    meds.setData((d) => (d ? { medications: d.medications.filter((x) => x.id !== id) } : d));
    todayRes.reload(true);
    adherence.reload(true);
  };

  const filteredMeds = person === "all" ? medsList : person === "me" ? medsList.filter((m) => !m.for_person) : medsList.filter((m) => m.for_person === person);
  const doses: DoseItem[] = todayRes.data?.doses ?? [];
  const filteredDoses = person === "all" ? doses : person === "me" ? doses.filter((d) => !d.for_person) : doses.filter((d) => d.for_person === person);
  const taken = filteredDoses.filter((d) => d.status === "taken").length;
  const refillCount = medsList.filter(needsRefill).length;
  const noMeds = !meds.loading && !meds.error && medsList.length === 0;
  const year = Number(today.slice(0, 4));

  return (
    <div>
      <PageHeader
        eyebrow="Care · Medicines"
        title="Medicines"
        description="Every alarm shows the medicine's photo — so the right strip is never in doubt, for you or whoever you care for."
        actions={
          <>
            <ButtonLink href="/dashboard/medicines/prescriptions" variant="secondary">
              <ScanLine size={16} aria-hidden />
              Scan prescription
            </ButtonLink>
            <Button variant="primary" onClick={openAdd}>
              <Plus size={16} aria-hidden />
              Add medicine
            </Button>
          </>
        }
      />

      {/* Prescription CTA */}
      <GlassCard variant="strong" padded={false} className="relative mb-6 overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-orza-energy opacity-[0.16] blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <IconTile tone="energy" className="h-11 w-11">
              <ScanLine size={20} aria-hidden />
            </IconTile>
            <div>
              <div className="font-editorial text-[18px] font-semibold leading-snug text-orza-strong">Scan a prescription, get alarms automatically</div>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-orza-muted">
                Snap your doctor&apos;s prescription — ÖRZA reads 1-0-1, BD, TDS, &ldquo;after food&rdquo; and &ldquo;x 5 days&rdquo;, and sets every alarm for you to review.
              </p>
            </div>
          </div>
          <ButtonLink href="/dashboard/medicines/prescriptions" variant="energy" className="shrink-0 self-start sm:self-center">
            <ScanLine size={16} aria-hidden />
            Scan a prescription
          </ButtonLink>
        </div>
      </GlassCard>

      {people.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Show medicines for">
          {[{ key: "all", label: "Everyone" }, { key: "me", label: "Me" }, ...people.map((p) => ({ key: p, label: p }))].map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={person === o.key}
              onClick={() => setPerson(o.key)}
              className={cn(
                "h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150",
                person === o.key ? "border-[#141414] bg-[#141414] text-orza-bg-0" : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-muted hover:text-orza-strong"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {noMeds ? (
        <EmptyState
          icon={<Pill size={22} aria-hidden />}
          title="No medicines yet"
          description="Add a medicine with a photo of its strip or bottle, or scan a prescription and ÖRZA sets the alarms for you."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/dashboard/medicines/prescriptions" variant="energy">
                <ScanLine size={16} aria-hidden /> Scan a prescription
              </ButtonLink>
              <Button variant="secondary" onClick={openAdd}>
                <Plus size={16} aria-hidden /> Add manually
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
          {/* Today */}
          <GlassCard as="section" aria-labelledby="meds-today" padded={false} className="p-4 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{formatDateShort(today, year)}</div>
                <h2 id="meds-today" className="mt-1 font-editorial text-[22px] font-semibold text-orza-strong">
                  Today
                </h2>
              </div>
              {filteredDoses.length > 0 && (
                <div className="text-[13px] text-orza-muted">
                  <span className="font-semibold text-orza-strong">{taken}</span> of {filteredDoses.length} taken
                </div>
              )}
            </div>
            {todayRes.loading && !todayRes.data ? (
              <TimelineSkeleton />
            ) : todayRes.error && !todayRes.data ? (
              <ErrorPanel message={todayRes.error} onRetry={() => todayRes.reload()} />
            ) : filteredDoses.length === 0 ? (
              <div className="rounded-orza-md border border-dashed border-[rgba(20,20,20,0.14)] bg-white/40 px-5 py-8 text-center">
                <div className="font-editorial text-[17px] font-semibold text-orza-strong">No doses scheduled today</div>
                <p className="mx-auto mt-1 max-w-sm text-[13px] text-orza-muted">
                  {medsList.some((m) => m.active && !m.as_needed)
                    ? "Nothing is due today on your current schedules. Enjoy the day."
                    : "Medicines with alarm times will show up here with Take, Snooze and Skip."}
                </p>
              </div>
            ) : (
              <TodayTimeline doses={filteredDoses} tz={tz} pendingFor={pendingFor} onAct={(d, a) => act(d, a)} />
            )}
          </GlassCard>

          <div className="space-y-6">
            {/* Adherence */}
            <GlassCard as="section" aria-labelledby="meds-week" padded={false} className="p-4 sm:p-5">
              <h2 id="meds-week" className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
                Last 7 days
              </h2>
              {adherence.error && !adherence.data ? (
                <ErrorPanel message={adherence.error} onRetry={() => adherence.reload()} />
              ) : (
                <AdherenceStrip data={adherence.data} loading={adherence.loading} today={today} />
              )}
            </GlassCard>

            {/* How alarms reach you */}
            <GlassCard as="section" aria-labelledby="meds-how" variant="subtle" padded={false} className="p-4 sm:p-5">
              <h2 id="meds-how" className="font-editorial text-[17px] font-semibold text-orza-strong">
                How your alarms reach you
              </h2>
              <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-orza-muted">
                <li className="flex gap-2.5">
                  <BellRing size={16} className="mt-0.5 shrink-0 text-[#E0593F]" aria-hidden />
                  <span>
                    <span className="font-medium text-orza-strong">Full-screen alarm with the photo</span> whenever ÖRZA is open in a tab.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <Smartphone size={16} className="mt-0.5 shrink-0 text-[#0B8FA6]" aria-hidden />
                  <span>
                    <span className="font-medium text-orza-strong">Push notifications</span> with the photo and Take / Snooze buttons (on iPhone, add ÖRZA to your Home Screen first).
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <MessageCircle size={16} className="mt-0.5 shrink-0 text-[#127A56]" aria-hidden />
                  <span>
                    <span className="font-medium text-orza-strong">WhatsApp</span> messages, if you turn them on.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <CalendarDays size={16} className="mt-0.5 shrink-0 text-[#6E3ED6]" aria-hidden />
                  <span>
                    <span className="font-medium text-orza-strong">Your phone calendar</span> — subscribe once and it rings natively, even with the browser closed.
                  </span>
                </li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink href="/dashboard/reminders" variant="secondary" size="sm">
                  Notification settings <ChevronRight size={14} aria-hidden />
                </ButtonLink>
                <ButtonLink href="/dashboard/calendar" variant="ghost" size="sm">
                  Calendar feed
                </ButtonLink>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Medicine list */}
      {!noMeds && (
        <section aria-labelledby="meds-list" className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="meds-list" className="font-editorial text-[22px] font-semibold text-orza-strong">
                Your medicines
              </h2>
              {refillCount > 0 && (
                <p className="mt-1 text-[13px] text-[#B02C2C]">
                  {refillCount === 1 ? "1 medicine needs a refill soon." : `${refillCount} medicines need a refill soon.`}
                </p>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={openAdd}>
              <Plus size={15} aria-hidden /> Add medicine
            </Button>
          </div>
          {meds.loading && !meds.data ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[124px] w-full !rounded-orza-md" />
              ))}
            </div>
          ) : meds.error && !meds.data ? (
            <ErrorPanel message={meds.error} onRetry={() => meds.reload()} />
          ) : filteredMeds.length === 0 ? (
            <p className="rounded-orza-md border border-dashed border-[rgba(20,20,20,0.14)] bg-white/40 px-5 py-6 text-center text-sm text-orza-muted">
              No medicines for this person yet.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {filteredMeds.map((m) => (
                <li key={m.id}>
                  <MedicineCard med={m} today={today} onOpen={openEdit} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs leading-relaxed text-orza-subtle">
            ÖRZA reminds you to take medicines as your doctor prescribed — it never changes doses. Always follow your doctor&apos;s advice.{" "}
            <Link href="/dashboard/medicines/prescriptions" className="underline underline-offset-2 hover:text-orza-strong">
              Prescription history
            </Link>
          </p>
        </section>
      )}

      <MedicineSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        med={editing}
        today={today}
        people={people}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    </div>
  );
}
