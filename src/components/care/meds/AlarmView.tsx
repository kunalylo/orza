"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Pill, RefreshCw, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { DEFAULT_TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/app/UserProvider";
import { BrandMark } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { MedPhoto } from "./MedPhoto";
import { DoseActionButtons, useDoseActions } from "./useDoseActions";
import {
  clockIn,
  formatTime12,
  isOpen,
  medicineTitle,
  STATUS_META,
  TIMING_INSTRUCTION,
  todayIn,
  type DoseAction,
  type DoseItem,
  type DueResponse,
} from "./shared";

const doseKey = (d: Pick<DoseItem, "medication_id" | "scheduled_for">) => `${d.medication_id}:${d.scheduled_for}`;
const BACK = "/dashboard/medicines";

/** Big swipeable gallery (scroll-snap) with dots, arrows and keyboard support. */
function PhotoGallery({ dose }: { dose: DoseItem }) {
  const urls = dose.photo_urls;
  const ref = React.useRef<HTMLDivElement>(null);
  const [idx, setIdx] = React.useState(0);
  const title = medicineTitle(dose);

  React.useEffect(() => {
    setIdx(0);
    ref.current?.scrollTo({ left: 0 });
  }, [dose.medication_id]);

  const go = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const n = Math.max(0, Math.min(urls.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  if (!urls.length) {
    return (
      <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center overflow-hidden rounded-orza-lg border border-white/15 bg-white/[0.06] text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,184,77,0.28),rgba(255,122,106,0.14)_40%,transparent_70%)]" aria-hidden />
        <span className="relative inline-flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white" role="img" aria-label={`${title} — no photo yet`}>
          <Pill size={44} strokeWidth={1.5} aria-hidden />
        </span>
        <p className="relative mt-4 max-w-[260px] px-4 text-[13px] leading-relaxed text-white/70">
          Add a photo of the strip or bottle so this alarm shows exactly what to take.
        </p>
        <Link
          href={`${BACK}?edit=${encodeURIComponent(dose.medication_id)}`}
          className="relative mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-white/25 px-4 text-[13px] font-medium text-white/90 hover:border-white/40 hover:text-white"
        >
          <Camera size={14} aria-hidden /> Add a photo
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Photos of ${title}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            go(idx + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            go(idx - 1);
          }
        }}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-orza-lg border border-white/15 bg-[#0E1319] [scrollbar-width:none] focus:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan [&::-webkit-scrollbar]:hidden"
      >
        {urls.map((u, i) => (
          <div key={u} className="h-full w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={`${i + 1} of ${urls.length}`}>
            <MedPhoto src={u} alt={`${title}, photo ${i + 1}`} fit="contain" tone="dark" iconSize={44} className="h-full w-full !bg-transparent" />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(7,9,12,0.55)] text-white backdrop-blur disabled:opacity-0"
            aria-label="Previous photo"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(idx + 1)}
            disabled={idx >= urls.length - 1}
            className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(7,9,12,0.55)] text-white backdrop-blur disabled:opacity-0"
            aria-label="Next photo"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
            {urls.map((u, i) => (
              <span key={u} className={cn("h-1.5 rounded-full transition-all duration-220", i === idx ? "w-5 bg-white" : "w-1.5 bg-white/35")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OtherDose({ dose, tz, pending, done, onAct }: { dose: DoseItem; tz: string; pending?: DoseAction; done?: boolean; onAct: (a: DoseAction) => void }) {
  const open = isOpen(dose) && !done;
  return (
    <li className="flex flex-col gap-3 rounded-orza-md border border-white/15 bg-white/[0.06] p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MedPhoto src={dose.photo_urls[0]} alt={medicineTitle(dose)} tone="dark" className="h-16 w-16 shrink-0 rounded-orza-sm border border-white/15" />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-white">{medicineTitle(dose)}</div>
          <div className="truncate text-[13px] text-white/65">
            {[dose.dose, TIMING_INSTRUCTION[dose.timing] ? TIMING_INSTRUCTION[dose.timing].replace("Take it ", "") : "", dose.for_person ? `for ${dose.for_person}` : ""].filter(Boolean).join(" · ")}
          </div>
          {!open && (
            <div className="mt-1 text-[12px] font-medium text-white/80">
              {dose.status === "snoozed" && dose.snooze_until ? `Snoozed until ${clockIn(tz, new Date(dose.snooze_until))}` : STATUS_META[dose.status].label}
            </div>
          )}
        </div>
      </div>
      {open && <DoseActionButtons dose={dose} pending={pending} onAct={onAct} tone="dark" className="sm:justify-end" />}
    </li>
  );
}

type Load = { loading: boolean; error: string | null; doses: DoseItem[]; next: DoseItem | null; mode: "at" | "due" };

/**
 * /dashboard/alarm?med=<id>&at=<iso> — immersive full-screen alarm over the app: large swipeable
 * photos, name, strength, dose and food timing, Take / Snooze 10 min / Skip, plus every other
 * dose due at the same time. Without params it shows everything due right now.
 */
export function AlarmView() {
  const params = useSearchParams();
  const medParam = params.get("med");
  const atParam = params.get("at");
  const router = useRouter();
  const { user } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;

  const [state, setState] = React.useState<Load>({ loading: true, error: null, doses: [], next: null, mode: atParam ? "at" : "due" });
  const [acted, setActed] = React.useState<Set<string>>(() => new Set());
  const [clock, setClock] = React.useState(() => clockIn(tz));
  const [leaving, setLeaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      if (atParam && !Number.isNaN(new Date(atParam).getTime())) {
        const r = await api.get<DueResponse>(`/meds/doses?at=${encodeURIComponent(atParam)}`);
        if (r.doses.length) {
          setState({ loading: false, error: null, doses: r.doses, next: null, mode: "at" });
          return;
        }
      }
      const r = await api.get<DueResponse>("/meds/doses");
      setState({ loading: false, error: null, doses: r.doses, next: r.next || null, mode: "due" });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errorMessage(e) }));
    }
  }, [atParam]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Live clock.
  React.useEffect(() => {
    setClock(clockIn(tz));
    const t = setInterval(() => setClock(clockIn(tz)), 15000);
    return () => clearInterval(t);
  }, [tz]);

  // Full-screen: no page scroll behind the overlay; Escape closes.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(BACK);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);

  // Order: the medicine from the link first, then by time and name.
  const ordered = React.useMemo(() => {
    const list = [...state.doses].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.name.localeCompare(b.name));
    const i = medParam ? list.findIndex((d) => d.medication_id === medParam) : -1;
    if (i > 0) list.unshift(...list.splice(i, 1));
    return list;
  }, [state.doses, medParam]);

  const actionable = (d: DoseItem) => isOpen(d) && !acted.has(doseKey(d));
  const current = ordered.find(actionable) || null;
  const others = current ? ordered.filter((d) => doseKey(d) !== doseKey(current)) : [];
  const userActed = acted.size > 0;
  const allDone = !state.loading && !state.error && ordered.length > 0 && !current;

  const { act, pendingFor } = useDoseActions({
    tz,
    onDone: (updated) => {
      setActed((s) => new Set(s).add(doseKey(updated)));
      setState((s) => ({ ...s, doses: s.doses.map((d) => (doseKey(d) === doseKey(updated) ? updated : d)) }));
    },
  });

  // Once everything on this alarm is handled, go back to Medicines.
  React.useEffect(() => {
    if (!allDone || !userActed) return;
    setLeaving(true);
    const t = setTimeout(() => router.replace(BACK), 1400);
    return () => clearTimeout(t);
  }, [allDone, userActed, router]);

  // A gentle buzz on phones when the alarm opens with something to take (ignored where unsupported).
  const buzzed = React.useRef(false);
  React.useEffect(() => {
    if (buzzed.current || !current) return;
    buzzed.current = true;
    try {
      navigator.vibrate?.([250, 120, 250]);
    } catch {
      /* not supported */
    }
  }, [current]);

  const sameTime = current ? formatTime12(current.local_time) : "";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alarm-title"
      aria-describedby="alarm-desc"
      className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-orza-hero text-white"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-[-18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-orza-energy opacity-30 blur-[110px] motion-safe:animate-orza-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[360px] w-[360px] rounded-full bg-[#0BBEDC] opacity-[0.12] blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between py-2">
          <BrandMark tone="dark" showPronunciation={false} className="text-white" />
          <button
            type="button"
            onClick={() => router.push(BACK)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close alarm"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {state.loading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-white/70" role="status">
            <Loader2 size={28} className="animate-spin" aria-hidden />
            <span id="alarm-title">Opening your alarm…</span>
            <span id="alarm-desc" className="sr-only">
              Loading the medicines due now
            </span>
          </div>
        ) : state.error ? (
          <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
            <h1 id="alarm-title" className="font-editorial text-[26px] font-semibold">
              We couldn&apos;t load this alarm
            </h1>
            <p id="alarm-desc" className="mt-2 max-w-sm text-sm text-white/70">
              {state.error}
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="hero" onClick={load}>
                <RefreshCw size={15} aria-hidden /> Try again
              </Button>
              <Button variant="hero-outline" onClick={() => router.push(BACK)}>
                Medicines
              </Button>
            </div>
          </div>
        ) : !current ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[#7EE2B8]">
              <CheckCircle2 size={32} aria-hidden />
            </span>
            <h1 id="alarm-title" className="mt-5 font-editorial text-[30px] font-semibold leading-tight">
              {allDone ? (userActed ? "All done — nicely handled" : "All set for this alarm") : "Nothing due right now"}
            </h1>
            <p id="alarm-desc" className="mt-2 max-w-sm text-[15px] text-white/70">
              {allDone
                ? leaving
                  ? "Taking you back to your medicines…"
                  : "Every medicine on this alarm has already been taken, skipped or snoozed."
                : state.next
                  ? `Next up: ${medicineTitle(state.next)} at ${formatTime12(state.next.local_time)}${state.next.local_date !== todayIn(tz) ? " tomorrow" : ""}.`
                  : "You're all caught up."}
            </p>
            {allDone && (
              <ul className="mt-6 w-full max-w-md space-y-2 text-left">
                {ordered.map((d) => (
                  <OtherDose key={doseKey(d)} dose={d} tz={tz} pending={pendingFor(d)} done={acted.has(doseKey(d))} onAct={(a) => act(d, a)} />
                ))}
              </ul>
            )}
            {!allDone && state.next && (
              <div className="mt-6 flex w-full max-w-sm items-center gap-3 rounded-orza-md border border-white/15 bg-white/[0.06] p-3 text-left">
                <MedPhoto src={state.next.photo_urls[0]} alt={medicineTitle(state.next)} tone="dark" className="h-14 w-14 shrink-0 rounded-orza-sm border border-white/15" />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{medicineTitle(state.next)}</div>
                  <div className="text-[13px] text-white/65">
                    {state.next.dose} · {formatTime12(state.next.local_time)}
                  </div>
                </div>
              </div>
            )}
            <Button variant="hero" className="mt-7" onClick={() => router.replace(BACK)}>
              {leaving ? "Back now" : "Go to medicines"}
            </Button>
          </div>
        ) : (
          <div className="flex-1 pb-4 pt-2 lg:grid lg:grid-cols-[1.1fr_1fr] lg:items-start lg:gap-10 lg:pt-6">
            <div>
              <PhotoGallery dose={current} />
            </div>

            <div className="mt-6 lg:mt-0">
              <div className="font-mono text-[12px] uppercase tracking-[0.16em] text-white/60">Time for your medicine</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-editorial text-[44px] font-semibold leading-none tabular-nums sm:text-[52px]" aria-label={`Local time ${clock}`}>
                  {clock}
                </span>
                {current.status === "snoozed" && current.snooze_until ? (
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[12px] font-medium text-white/80">Snoozed until {clockIn(tz, new Date(current.snooze_until))}</span>
                ) : current.status === "missed" ? (
                  <span className="rounded-full bg-[rgba(255,122,106,0.2)] px-2.5 py-1 text-[12px] font-medium text-[#FFB4A8]">Was due at {formatTime12(current.local_time)}</span>
                ) : (
                  <span className="text-[13px] text-white/55">Scheduled {formatTime12(current.local_time)}</span>
                )}
              </div>

              <h1 id="alarm-title" className="mt-5 font-editorial text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
                {current.name}
                {current.strength && <span className="ml-2 text-[0.6em] font-normal text-white/70">{current.strength}</span>}
              </h1>
              <div id="alarm-desc" className="mt-3 space-y-2">
                <p className="text-[20px] font-medium text-white">{current.dose}</p>
                {TIMING_INSTRUCTION[current.timing] && (
                  <p className="inline-flex rounded-full bg-[rgba(255,184,77,0.16)] px-3 py-1 text-[14px] font-medium text-[#FFD08A]">{TIMING_INSTRUCTION[current.timing]}</p>
                )}
                {current.instructions && <p className="text-[14px] leading-relaxed text-white/75">{current.instructions}</p>}
                {current.for_person && <p className="text-[14px] text-white/75">For {current.for_person}</p>}
              </div>

              <div className="mt-7 grid gap-2.5 sm:grid-cols-[1.4fr_1fr]">
                <Button
                  variant="energy"
                  size="lg"
                  className="h-14 text-[16px] sm:col-span-2"
                  onClick={() => act(current, "take")}
                  loading={pendingFor(current) === "take"}
                  disabled={!!pendingFor(current)}
                  autoFocus
                >
                  {pendingFor(current) !== "take" && <CheckCircle2 size={20} aria-hidden />}
                  Take {/^[0-9½¼¾]/.test(current.dose) && current.dose.length <= 18 ? current.dose : "now"}
                </Button>
                <Button
                  variant="hero-outline"
                  size="lg"
                  className="h-12"
                  onClick={() => act(current, "snooze")}
                  loading={pendingFor(current) === "snooze"}
                  disabled={!!pendingFor(current)}
                >
                  Snooze 10 min
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-12 text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => act(current, "skip")}
                  loading={pendingFor(current) === "skip"}
                  disabled={!!pendingFor(current)}
                >
                  Skip this dose
                </Button>
              </div>

              {others.length > 0 && (
                <section aria-labelledby="alarm-others" className="mt-8">
                  <h2 id="alarm-others" className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
                    {state.mode === "at" ? `Also at ${sameTime}` : "Also due now"}
                  </h2>
                  <ul className="space-y-2.5">
                    {others.map((d) => (
                      <OtherDose key={doseKey(d)} dose={d} tz={tz} pending={pendingFor(d)} done={acted.has(doseKey(d))} onAct={(a) => act(d, a)} />
                    ))}
                  </ul>
                </section>
              )}

              <p className="mt-8 text-[12px] leading-relaxed text-white/45">
                Take medicines as your doctor prescribed. Unsure about a dose? Check with your doctor or pharmacist.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
