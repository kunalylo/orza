"use client";
import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  BellRing,
  Camera,
  CheckCircle2,
  ChevronRight,
  Coins,
  FileText,
  ImageUp,
  Keyboard,
  Lightbulb,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { DEFAULT_TZ } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader, WellnessNote } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { GlassCard, IconTile, Tag } from "@/components/orza/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, Skeleton } from "@/components/ui/form";
import { useAiStatus } from "@/components/meals/useAiStatus";
import { MedPhoto } from "./MedPhoto";
import { PhotoError, prepareCarePhoto } from "./photo";
import { emptyRow, ReviewTable, rowProblem, toRows } from "./ReviewTable";
import { RxViewfinder } from "./RxViewfinder";
import { formatDateShort, scheduleSummary, todayIn, type MedicationClient, type PrescriptionClient, type ReviewRow } from "./shared";

type Phase = "pick" | "scanning" | "review" | "done";
type Problem = { kind: "ai_disabled" | "no_credits" | "error"; message: string };

const SCAN_COST_FALLBACK = 2;

function ProblemPanel({ problem, onManual, onRetry }: { problem: Problem; onManual: () => void; onRetry?: () => void }) {
  const title =
    problem.kind === "ai_disabled" ? "Scanning isn't available right now" : problem.kind === "no_credits" ? "You're out of AI credits" : "We couldn't read that prescription";
  return (
    <div className="rounded-orza-md border border-[rgba(176,106,0,0.25)] bg-[#FFF8EE] p-4" role="alert">
      <div className="font-semibold text-[#8A5300]">{title}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-[#8A5300]/90">{problem.message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onManual}>
          <Keyboard size={15} aria-hidden /> Type the medicines instead
        </Button>
        {problem.kind === "no_credits" && (
          <ButtonLink href="/dashboard/credits" size="sm" variant="secondary">
            <Coins size={15} aria-hidden /> Get more credits
          </ButtonLink>
        )}
        {problem.kind === "error" && onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden /> Try again
          </Button>
        )}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[76px] w-full !rounded-orza-md" />
      ))}
    </div>
  );
}

/**
 * /dashboard/medicines/prescriptions — photo → AI read → editable review → "Create alarms".
 * Manual entry when AI is off (or the user prefers typing); history of past prescriptions.
 */
export function PrescriptionsView() {
  const { user, setCredits } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const today = todayIn(tz);
  const year = Number(today.slice(0, 4));
  const aiStatus = useAiStatus();
  const aiOff = aiStatus?.ai_enabled === false;
  const scanCost = aiStatus?.costs?.scan ?? SCAN_COST_FALLBACK;

  const [phase, setPhase] = React.useState<Phase>("pick");
  const [manual, setManual] = React.useState(false);
  const [image, setImage] = React.useState<string | null>(null);
  const [preparing, setPreparing] = React.useState(false);
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [rx, setRx] = React.useState<PrescriptionClient | null>(null);
  const [rows, setRows] = React.useState<ReviewRow[]>([]);
  const [doctor, setDoctor] = React.useState("");
  const [startDate, setStartDate] = React.useState(today);
  const [forPerson, setForPerson] = React.useState("");
  const [showErrors, setShowErrors] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [created, setCreated] = React.useState<MedicationClient[]>([]);

  const [history, setHistory] = React.useState<PrescriptionClient[] | null>(null);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PrescriptionClient | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const cameraRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  const loadHistory = React.useCallback(async () => {
    try {
      const r = await api.get<{ prescriptions: PrescriptionClient[] }>("/prescriptions");
      setHistory(r.prescriptions);
      setHistoryError(null);
    } catch (e) {
      setHistoryError(errorMessage(e));
    }
  }, []);
  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const scrollTop = () => requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const reset = () => {
    setPhase("pick");
    setManual(false);
    setImage(null);
    setProblem(null);
    setRx(null);
    setRows([]);
    setDoctor("");
    setStartDate(todayIn(tz));
    setForPerson("");
    setShowErrors(false);
    setCreated([]);
    scrollTop();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreparing(true);
    try {
      const dataUrl = await prepareCarePhoto(file);
      setImage(dataUrl);
      setProblem(null);
    } catch (err) {
      toast.error(err instanceof PhotoError ? err.message : "We couldn't read that photo. Please try another.");
    } finally {
      setPreparing(false);
    }
  };

  const startManual = () => {
    setManual(true);
    setProblem(null);
    setRows((r) => (r.length ? r : [emptyRow()]));
    setShowErrors(false);
    setPhase("review");
    scrollTop();
  };

  const scan = async () => {
    if (!image || phase === "scanning") return;
    setPhase("scanning");
    setProblem(null);
    try {
      const res = await api.post<{ prescription: PrescriptionClient; credits?: number }>("/prescriptions/scan", { image });
      if (typeof res.credits === "number") setCredits(res.credits);
      setRx(res.prescription);
      setRows(toRows(res.prescription.medicines));
      setDoctor(res.prescription.doctor || "");
      setManual(false);
      setShowErrors(false);
      setPhase("review");
      loadHistory();
      scrollTop();
    } catch (err) {
      setPhase("pick");
      if (err instanceof ApiError && err.code === "ai_disabled") setProblem({ kind: "ai_disabled", message: err.message });
      else if (err instanceof ApiError && (err.status === 402 || err.code === "no_credits")) setProblem({ kind: "no_credits", message: err.message });
      else setProblem({ kind: "error", message: errorMessage(err) });
    }
  };

  const reviewExisting = (p: PrescriptionClient) => {
    setRx(p);
    setImage(p.photo_url);
    setRows(p.medicines.length ? toRows(p.medicines) : [emptyRow()]);
    setDoctor(p.doctor || "");
    setManual(!p.medicines.length);
    setProblem(null);
    setShowErrors(false);
    setStartDate(todayIn(tz));
    setPhase("review");
    scrollTop();
  };

  const included = rows.filter((r) => r.include);

  const createAlarms = async () => {
    if (applying) return;
    setShowErrors(true);
    if (!included.length) {
      toast.error("Tick at least one medicine to create alarms.");
      return;
    }
    if (included.some((r) => rowProblem(r))) {
      toast.error("Please check the highlighted medicines.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      toast.error("Choose a start date.");
      return;
    }
    setApplying(true);
    try {
      let id = rx?.id;
      if (!id) {
        const r = await api.post<{ prescription: PrescriptionClient }>("/prescriptions", {
          image: image && image.startsWith("data:") ? image : undefined,
          doctor: doctor.trim() || undefined,
        });
        id = r.prescription.id;
        setRx(r.prescription);
      }
      const res = await api.post<{ medications: MedicationClient[]; prescription: PrescriptionClient }>(`/prescriptions/${id}/apply`, {
        medicines: included.map(({ key: _key, include: _include, ...m }) => ({ ...m, name: m.name.trim(), dose: m.dose.trim() })),
        start_date: startDate,
        for_person: forPerson.trim() || undefined,
      });
      setCreated(res.medications);
      setRx(res.prescription);
      setPhase("done");
      const alarms = res.medications.filter((m) => !m.as_needed).length;
      toast.success(alarms ? `${alarms} medicine${alarms === 1 ? "" : "s"} now ${alarms === 1 ? "has" : "have"} alarms` : "Medicines added");
      loadHistory();
      scrollTop();
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_applied") {
        toast.message("Alarms were already created from this prescription.");
        loadHistory();
        reset();
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setApplying(false);
    }
  };

  const deleteRx = async (p: PrescriptionClient) => {
    setDeleting(p.id);
    try {
      await api.del(`/prescriptions/${p.id}`);
      setHistory((h) => (h ? h.filter((x) => x.id !== p.id) : h));
      if (rx?.id === p.id && phase === "review") reset();
      toast.success("Prescription deleted");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const busy = preparing || phase === "scanning";

  return (
    <div ref={topRef} className="scroll-mt-20">
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
      <input ref={uploadRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />

      <Link href="/dashboard/medicines" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-orza-muted hover:text-orza-strong">
        <ArrowLeft size={14} aria-hidden /> Medicines
      </Link>
      <PageHeader
        eyebrow="Care · Prescriptions"
        title={phase === "done" ? "Alarms are set" : phase === "review" ? "Check and create alarms" : "Scan a prescription"}
        description={
          phase === "review"
            ? "Compare each line with your prescription, fix anything that's off, untick what you don't need — nothing is saved until you tap Create alarms."
            : "Take a photo of your doctor's prescription. ÖRZA reads every medicine — brand names, 1-0-1, BD, TDS, SOS, after food, x 5 days — and sets the alarms for you to review."
        }
      />

      {/* ─────────── Pick / scan ─────────── */}
      {(phase === "pick" || phase === "scanning") && (
        <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-start">
          <GlassCard variant="strong" padded={false} className="p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", phase === "scanning" ? "animate-orza-pulse bg-[#2FD2F0]" : image ? "bg-[#127A56]" : "bg-orza-dot")} aria-hidden />
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{phase === "scanning" ? "Reading" : image ? "Photo ready" : "Prescription"}</span>
              </div>
              {image && <span className="text-[11px] text-orza-subtle">Resized on your device</span>}
            </div>
            <RxViewfinder image={image} scanning={phase === "scanning"} />

            <div className="mt-4 space-y-3">
              {problem && <ProblemPanel problem={problem} onManual={startManual} onRetry={problem.kind === "error" ? scan : undefined} />}
              {aiOff && !problem && (
                <div className="rounded-orza-md border border-[rgba(11,143,166,0.22)] bg-[#EAF6FF] p-3.5 text-[13px] leading-relaxed text-[#0B6F82]">
                  Automatic reading isn&apos;t available right now. Type the medicines from your prescription — it takes a minute, and you can attach the photo for reference.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {image && !aiOff ? (
                  <>
                    <Button variant="energy" size="lg" onClick={scan} loading={phase === "scanning"} disabled={busy} className="flex-1 sm:flex-none">
                      {phase !== "scanning" && <ScanLine size={17} aria-hidden />}
                      {phase === "scanning" ? "Reading…" : "Read prescription"}
                      {phase !== "scanning" && <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold">{scanCost} credits</span>}
                    </Button>
                    <Button variant="secondary" size="lg" onClick={() => cameraRef.current?.click()} disabled={busy}>
                      <Camera size={16} aria-hidden /> Retake
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant={aiOff ? "secondary" : "energy"} size="lg" onClick={() => cameraRef.current?.click()} disabled={busy} loading={preparing}>
                      {!preparing && <Camera size={17} aria-hidden />}
                      Take photo
                    </Button>
                    <Button variant="secondary" size="lg" onClick={() => uploadRef.current?.click()} disabled={busy}>
                      <ImageUp size={16} aria-hidden /> Upload photo
                    </Button>
                  </>
                )}
                {image && !aiOff && (
                  <Button variant="ghost" size="lg" onClick={() => uploadRef.current?.click()} disabled={busy}>
                    <ImageUp size={16} aria-hidden /> Choose another
                  </Button>
                )}
              </div>
              <Button variant={aiOff ? "primary" : "ghost"} size={aiOff ? "lg" : "sm"} onClick={startManual} disabled={phase === "scanning"}>
                <Keyboard size={15} aria-hidden />
                {aiOff ? (image ? "Type the medicines" : "Type the medicines instead") : "Prefer typing? Enter medicines manually"}
              </Button>
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard padded={false} className="p-4 sm:p-5">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
                <Lightbulb size={13} aria-hidden /> For the best read
              </div>
              <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-orza-muted">
                <li>Lay the prescription flat in daylight; avoid shadows and glare.</li>
                <li>Fit the whole page in the frame — dosage columns are often at the edge.</li>
                <li>Handwriting is fine. Anything hard to read is flagged for you to check.</li>
                <li>One prescription per photo. Scan each page separately.</li>
              </ul>
            </GlassCard>
            <GlassCard variant="subtle" padded={false} className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <IconTile tone="cyan">
                  <ShieldCheck size={18} aria-hidden />
                </IconTile>
                <p className="text-[13px] leading-relaxed text-orza-muted">
                  Your photo is stored privately in your account. It&apos;s shown on each medicine&apos;s alarm until you add a photo of the actual strip or bottle.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* ─────────── Review ─────────── */}
      {phase === "review" && (
        <div className="space-y-5">
          <GlassCard padded={false} className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {image ? (
                <button
                  type="button"
                  onClick={() => rx && setPreview({ ...rx, photo_url: image })}
                  disabled={!rx}
                  className="w-full shrink-0 overflow-hidden rounded-orza-sm border border-[rgba(20,20,20,0.08)] sm:w-40"
                  aria-label="View the prescription photo"
                >
                  <img src={image} alt="Prescription photo" className="h-40 w-full bg-[#EFE7DD] object-contain sm:h-32" />
                </button>
              ) : null}
              <div className="min-w-0 flex-1 space-y-3">
                {manual ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="rx-doctor">Doctor (optional)</Label>
                        <Input id="rx-doctor" value={doctor} onChange={(e) => setDoctor(e.target.value)} placeholder="e.g. Dr. Mehta" maxLength={80} disabled={!!rx} />
                      </div>
                      {!image && (
                        <div>
                          <div className="mb-1.5 text-[13px] font-medium text-orza-strong">Prescription photo (optional)</div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" size="sm" onClick={() => cameraRef.current?.click()} disabled={preparing || !!rx} loading={preparing}>
                              {!preparing && <Camera size={14} aria-hidden />} Take photo
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => uploadRef.current?.click()} disabled={preparing || !!rx}>
                              <ImageUp size={14} aria-hidden /> Upload
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed text-orza-subtle">
                      Type each medicine as written. Use the notation on your prescription — 1-0-1, BD, TDS, SOS, &ldquo;after food x 5 days&rdquo; — and ÖRZA fills in the alarm times.
                    </p>
                  </>
                ) : (
                  <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                    {rx?.doctor && (
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Doctor</dt>
                        <dd className="text-orza-strong">{rx.doctor}</dd>
                      </div>
                    )}
                    {rx?.issued_on && (
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Dated</dt>
                        <dd className="text-orza-strong">{formatDateShort(rx.issued_on, year)}</dd>
                      </div>
                    )}
                    {rx?.patient_name && (
                      <div>
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Patient</dt>
                        <dd className="text-orza-strong">{rx.patient_name}</dd>
                      </div>
                    )}
                    {rx?.notes && (
                      <div className="sm:col-span-2">
                        <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Notes</dt>
                        <dd className="text-orza-muted">{rx.notes}</dd>
                      </div>
                    )}
                    {!rx?.doctor && !rx?.issued_on && !rx?.patient_name && !rx?.notes && (
                      <div className="sm:col-span-2 text-orza-muted">Read from your photo. Check each medicine below.</div>
                    )}
                  </dl>
                )}
                {!manual && rx && rx.medicines.length === 0 && (
                  <p className="rounded-orza-sm bg-[#FFF8EE] px-3 py-2 text-[13px] text-[#8A5300]" role="status">
                    We couldn&apos;t find any medicines in this photo. Add them below, or{" "}
                    <button type="button" className="font-semibold underline underline-offset-2" onClick={reset}>
                      try a clearer photo
                    </button>
                    .
                  </p>
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard padded={false} className="p-3 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
              <h2 className="font-editorial text-[20px] font-semibold text-orza-strong">Medicines</h2>
              <span className="text-[13px] text-orza-muted">
                {included.length} of {rows.length} selected
              </span>
            </div>
            <ReviewTable rows={rows} onChange={setRows} showErrors={showErrors} />
          </GlassCard>

          <GlassCard padded={false} className="p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="rx-start">Start alarms from</Label>
                <Input id="rx-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <p className="mt-1.5 text-xs text-orza-subtle">Course lengths (e.g. x 5 days) count from this day.</p>
              </div>
              <div>
                <Label htmlFor="rx-for">These medicines are for (optional)</Label>
                <Input id="rx-for" value={forPerson} onChange={(e) => setForPerson(e.target.value)} placeholder="e.g. Mom — leave empty if they're yours" maxLength={40} />
                {rx?.patient_name && <p className="mt-1.5 text-xs text-orza-subtle">The prescription names {rx.patient_name}.</p>}
              </div>
            </div>
            <div className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-orza-subtle">
              <p>ÖRZA copies what&apos;s written and never changes a dose. If anything differs from your prescription, trust the prescription and ask your doctor or pharmacist.</p>
              <WellnessNote />
            </div>
          </GlassCard>

          <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex flex-wrap items-center justify-end gap-2 rounded-full border border-[rgba(20,20,20,0.10)] bg-[rgba(251,247,241,0.94)] p-2 shadow-orza-floating backdrop-blur-orza lg:bottom-6">
            <Button variant="ghost" onClick={reset} disabled={applying}>
              Start over
            </Button>
            <Button variant="energy" size="lg" onClick={createAlarms} loading={applying} disabled={!included.length}>
              {!applying && <BellRing size={17} aria-hidden />}
              Create alarms{included.length ? ` (${included.length})` : ""}
            </Button>
          </div>
        </div>
      )}

      {/* ─────────── Done ─────────── */}
      {phase === "done" && (
        <GlassCard variant="strong" padded={false} className="p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF7F1] text-[#127A56]">
              <CheckCircle2 size={22} aria-hidden />
            </span>
            <div>
              <h2 className="font-editorial text-[22px] font-semibold text-orza-strong">
                {created.length} medicine{created.length === 1 ? "" : "s"} added
              </h2>
              <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-orza-muted">
                Alarms show the prescription photo for now. Add a photo of each strip or bottle so everyone can match the right medicine at a glance.
              </p>
            </div>
          </div>
          <ul className="mt-5 divide-y divide-[rgba(20,20,20,0.06)] rounded-orza-md border border-[rgba(20,20,20,0.08)] bg-white/60">
            {created.map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <MedPhoto src={m.photo_urls[0]} alt={m.name} className="h-12 w-12 shrink-0 rounded-orza-sm border border-[rgba(20,20,20,0.08)]" iconSize={18} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-orza-strong">{[m.name, m.strength].filter(Boolean).join(" ")}</div>
                  <div className="truncate text-[12px] text-orza-muted">
                    {m.dose} · {scheduleSummary(m, today)}
                  </div>
                </div>
                <ButtonLink href={`/dashboard/medicines?edit=${encodeURIComponent(m.id)}`} variant="secondary" size="sm" className="shrink-0" aria-label={`Add a pill photo for ${m.name}`}>
                  <Camera size={14} aria-hidden />
                  <span className="hidden sm:inline">Add pill photo</span>
                  <span className="sm:hidden">Photo</span>
                </ButtonLink>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/dashboard/medicines" variant="primary">
              See today&apos;s doses <ChevronRight size={15} aria-hidden />
            </ButtonLink>
            <ButtonLink href="/dashboard/reminders" variant="secondary">
              <BellRing size={15} aria-hidden /> Notification settings
            </ButtonLink>
            <Button variant="ghost" onClick={reset}>
              <ScanLine size={15} aria-hidden /> Scan another
            </Button>
          </div>
        </GlassCard>
      )}

      {/* ─────────── History ─────────── */}
      <section aria-labelledby="rx-history" className="mt-10">
        <h2 id="rx-history" className="mb-4 font-editorial text-[22px] font-semibold text-orza-strong">
          Your prescriptions
        </h2>
        {history === null && !historyError ? (
          <HistorySkeleton />
        ) : historyError && !history ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-orza-md border border-[rgba(176,44,44,0.18)] bg-[#FDF3F3] p-4 text-sm text-[#8A2323]" role="alert">
            {historyError}
            <Button variant="secondary" size="sm" onClick={loadHistory}>
              <RefreshCw size={14} aria-hidden /> Try again
            </Button>
          </div>
        ) : !history?.length ? (
          <EmptyState icon={<FileText size={20} aria-hidden />} title="No prescriptions yet" description="Prescriptions you scan or type appear here, with their photo and the alarms they created." />
        ) : (
          <ul className="space-y-2.5">
            {history.map((p) => {
              const applied = p.status === "applied";
              const count = applied ? p.applied_medication_ids?.length ?? p.medicines.length : p.medicines.length;
              const title = p.doctor || (p.medicines.length ? p.medicines.slice(0, 3).map((m) => m.name).join(", ") : "Prescription");
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.62)] p-3 shadow-orza-glass backdrop-blur-orza">
                  <button
                    type="button"
                    onClick={() => p.photo_url && setPreview(p)}
                    disabled={!p.photo_url}
                    className="shrink-0 overflow-hidden rounded-orza-sm border border-[rgba(20,20,20,0.08)]"
                    aria-label={p.photo_url ? `View photo of ${title}` : `${title} — no photo`}
                  >
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="h-14 w-14 bg-[#EFE7DD] object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center bg-[#F4EDE3] text-orza-muted">
                        <FileText size={18} aria-hidden />
                      </span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-semibold text-orza-strong">{title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-orza-muted">
                      <span>{formatDateShort((p.issued_on || p.created_at).slice(0, 10), year)}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {count} medicine{count === 1 ? "" : "s"}
                      </span>
                      <Tag tone={applied ? "success" : "warning"} size="sm">
                        {applied ? "Alarms created" : "Needs review"}
                      </Tag>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {confirmDelete === p.id ? (
                      <>
                        <Button variant="danger" size="sm" onClick={() => deleteRx(p)} loading={deleting === p.id}>
                          Delete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleting === p.id}>
                          Keep
                        </Button>
                      </>
                    ) : (
                      <>
                        {applied ? (
                          <ButtonLink href="/dashboard/medicines" variant="ghost" size="sm">
                            Medicines
                          </ButtonLink>
                        ) : (
                          <Button variant="secondary" size="sm" onClick={() => reviewExisting(p)} disabled={phase === "scanning" || applying}>
                            Review
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(p.id)} aria-label={`Delete prescription ${title}`} className="h-9 w-9 hover:text-[#B02C2C]">
                          <Trash2 size={15} aria-hidden />
                        </Button>
                      </>
                    )}
                  </div>
                  {confirmDelete === p.id && (
                    <p className="w-full text-[12px] text-orza-muted">
                      {applied ? "Medicines created from it keep their alarms." : "This removes the scan and its photo."}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        {preview && (
          <DialogContent title={preview.doctor || "Prescription"} description={formatDateShort((preview.issued_on || preview.created_at).slice(0, 10), year)} className="sm:w-[min(760px,calc(100%-32px))]">
            {preview.photo_url ? (
              <img src={preview.photo_url} alt="Prescription photo" className="max-h-[70dvh] w-full rounded-orza-sm bg-[#EFE7DD] object-contain" />
            ) : (
              <p className="text-sm text-orza-muted">No photo was attached.</p>
            )}
          </DialogContent>
        )}
      </Dialog>

      {preparing && phase === "review" && (
        <p className="sr-only" role="status">
          Preparing photo
        </p>
      )}
    </div>
  );
}
