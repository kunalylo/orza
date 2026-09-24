"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Camera, ImageUp, ScanLine, Sparkles, UtensilsCrossed } from "lucide-react";
import type { Meal, MealType, Scan } from "@/lib/types";
import { api, ApiError, errorMessage } from "@/lib/api-client";
import { addDays, dateInTz, DEFAULT_TZ } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";
import { PageHeader, WellnessNote } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { GlassCard } from "@/components/orza/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldHint, Input, Label, Skeleton } from "@/components/ui/form";
import { draftsValid, fromDraft, toDraft, type DraftItem } from "./ItemEditor";
import { PhotoError, preparePhoto } from "./image";
import { AiDisabledPanel, LoggedPanel, NoCreditsPanel, ScanErrorPanel, ScanResultPanel, ScanTips } from "./ScanPanels";
import { ScanViewfinder, type ScanPhase } from "./ScanViewfinder";
import { useAiStatus } from "./useAiStatus";
import {
  FALLBACK_COSTS,
  MEAL_SINGULAR,
  formatDayLabel,
  guessMealTypeClient,
  isMealType,
  isRealDay,
  type ScanResponse,
} from "./meal-utils";

type Problem = { kind: "ai_disabled" | "no_credits" | "error"; message: string };

/** Suspense fallback for the page (useSearchParams). */
export function ScanSkeleton() {
  return (
    <div aria-busy aria-label="Loading Snap & Know">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="aspect-[4/3] w-full !rounded-orza-md" />
        <Skeleton className="h-[360px] w-full !rounded-orza-md" />
      </div>
    </div>
  );
}

function AnalysingPanel() {
  return (
    <GlassCard variant="strong" aria-hidden>
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">
        <Sparkles size={12} strokeWidth={1.75} className="text-[#0B8FA6]" />
        ÖRZA analysis
      </div>
      <Skeleton className="mt-3 h-7 w-3/4" />
      <Skeleton className="mt-3 h-5 w-32 !rounded-full" />
      <div className="mt-5 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
      <div className="mt-6 space-y-2.5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[88px] w-full" />
        ))}
      </div>
    </GlassCard>
  );
}

/** /dashboard/scan — Snap & Know: photo → AI estimate → review & edit → log. `?date=` / `?meal_type=` supported. */
export function ScanView() {
  const { user, setCredits } = useUser();
  const tz = user.profile?.timezone || DEFAULT_TZ;
  const params = useSearchParams();
  const router = useRouter();
  const today = dateInTz(tz);
  const q = params.get("date");
  const date = isRealDay(q) && q < today ? q : today;
  const isToday = date === today;
  const dayLabel = formatDayLabel(date, today, addDays(today, -1));
  const qType = params.get("meal_type");

  const aiStatus = useAiStatus();
  const [image, setImage] = React.useState<string | null>(null);
  const [preparing, setPreparing] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [phase, setPhase] = React.useState<ScanPhase>("idle");
  const [scan, setScan] = React.useState<Scan | null>(null);
  const [rows, setRows] = React.useState<DraftItem[]>([]);
  const [mealType, setMealType] = React.useState<MealType>(() => (isMealType(qType) ? qType : guessMealTypeClient(tz)));
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [logging, setLogging] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);
  const [logged, setLogged] = React.useState<Meal | null>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);
  const topRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isMealType(qType)) setMealType(qType);
  }, [qType]);

  const aiOff = aiStatus?.ai_enabled === false || problem?.kind === "ai_disabled";
  const scanCost = aiStatus?.costs?.scan ?? FALLBACK_COSTS.scan;
  const busy = preparing || phase === "scanning";
  const mealsHref = `/dashboard/meals${isToday ? "" : `?date=${date}`}`;

  const reset = () => {
    setImage(null);
    setNote("");
    setScan(null);
    setRows([]);
    setPhase("idle");
    setProblem(null);
    setLogged(null);
    setShowErrors(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setPreparing(true);
    try {
      const { dataUrl } = await preparePhoto(file);
      const keepNote = note;
      reset();
      setNote(keepNote);
      setImage(dataUrl);
      setPhase("ready");
    } catch (err) {
      toast.error(err instanceof PhotoError ? err.message : "We couldn't read that photo. Please try another.");
    } finally {
      setPreparing(false);
    }
  };

  const openCamera = () => cameraRef.current?.click();
  const openUpload = () => uploadRef.current?.click();

  const analyse = async () => {
    if (!image || phase === "scanning") return;
    setPhase("scanning");
    setProblem(null);
    try {
      const res = await api.post<ScanResponse>("/meals/scan", { image, note: note.trim() || undefined });
      if (typeof res.credits === "number") setCredits(res.credits);
      setScan(res.scan);
      setRows(res.scan.items.map(toDraft));
      setShowErrors(false);
      setPhase("result");
      // On phones the review panel sits below the photo — bring it into view.
      if (window.matchMedia("(max-width: 1023px)").matches) {
        requestAnimationFrame(() => document.getElementById("scan-review")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } catch (err) {
      setPhase("ready");
      if (err instanceof ApiError && err.code === "ai_disabled") setProblem({ kind: "ai_disabled", message: err.message });
      else if (err instanceof ApiError && (err.status === 402 || err.code === "no_credits")) setProblem({ kind: "no_credits", message: err.message });
      else setProblem({ kind: "error", message: errorMessage(err) });
    }
  };

  const logMeal = async () => {
    if (!scan || logging) return;
    setShowErrors(true);
    if (!draftsValid(rows)) {
      toast.error(rows.length ? "Please check the highlighted fields." : "Add at least one item before logging.");
      return;
    }
    setLogging(true);
    try {
      const r = await api.post<{ meal: Meal }>(`/meals/scan/${scan.id}/confirm`, {
        items: rows.map(fromDraft),
        meal_type: mealType,
        date,
      });
      setLogged(r.meal);
      setPhase("logged");
      toast.success(`Logged to ${MEAL_SINGULAR[r.meal.meal_type].toLowerCase()} — ${formatNumber(r.meal.totals.calories)} kcal`, {
        action: { label: "View log", onClick: () => router.push(mealsHref) },
      });
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_confirmed") {
        toast.message("This scan is already in your meal log.");
        reset();
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setLogging(false);
    }
  };

  const scanAnother = () => {
    reset();
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ─── right column ─── */
  let side: React.ReactNode;
  if (aiOff) side = <AiDisabledPanel message={problem?.kind === "ai_disabled" ? problem.message : undefined} mealsHref={mealsHref} />;
  else if (phase === "logged" && logged) side = <LoggedPanel meal={logged} mealsHref={mealsHref} onScanAnother={scanAnother} />;
  else if (phase === "result" && scan)
    side = (
      <ScanResultPanel
        scan={scan}
        rows={rows}
        onRowsChange={setRows}
        mealType={mealType}
        onMealTypeChange={setMealType}
        dayLabel={dayLabel}
        showErrors={showErrors}
        logging={logging}
        onLog={logMeal}
        onReset={scanAnother}
      />
    );
  else if (phase === "scanning") side = <AnalysingPanel />;
  else if (problem?.kind === "no_credits") side = <NoCreditsPanel mealsHref={mealsHref} onRetry={analyse} />;
  else if (problem?.kind === "error")
    side = <ScanErrorPanel message={problem.message} onRetry={image ? analyse : undefined} onPickAnother={openUpload} />;
  else side = <ScanTips scanCost={scanCost} />;

  /* ─── controls under the viewfinder ─── */
  let controls: React.ReactNode = null;
  if (!image || phase === "idle") {
    controls = (
      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={openCamera} disabled={aiOff || busy} loading={preparing}>
          {!preparing && <Camera size={16} strokeWidth={1.75} aria-hidden />} {preparing ? "Preparing…" : "Take photo"}
        </Button>
        <Button size="lg" variant="secondary" onClick={openUpload} disabled={aiOff || busy}>
          <ImageUp size={16} strokeWidth={1.75} aria-hidden /> Upload
        </Button>
      </div>
    );
  } else if (phase === "ready" || phase === "scanning") {
    const scanning = phase === "scanning";
    controls = (
      <div className="space-y-4">
        <div>
          <Label htmlFor="scan-note">
            Add a note <span className="font-normal text-orza-subtle">(optional)</span>
          </Label>
          <Input
            id="scan-note"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && void analyse()}
            disabled={scanning || aiOff}
            placeholder="e.g. homemade, less oil · restaurant · shared between two"
            autoComplete="off"
          />
          <FieldHint>Tell ÖRZA what the camera can&apos;t see — it changes the oil and portion estimate.</FieldHint>
        </div>
        <Button variant="energy" size="lg" className="w-full" onClick={analyse} loading={scanning} disabled={aiOff || preparing}>
          {!scanning && <ScanLine size={16} strokeWidth={1.75} aria-hidden />}
          {scanning ? "Analysing your plate…" : `Analyse photo · ${scanCost} credits`}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={openCamera} disabled={busy}>
              <Camera size={14} strokeWidth={1.75} aria-hidden /> Retake
            </Button>
            <Button variant="ghost" size="sm" onClick={openUpload} disabled={busy}>
              <ImageUp size={14} strokeWidth={1.75} aria-hidden /> Choose another
            </Button>
          </div>
          <span className="text-[12px] text-orza-subtle">
            {scanning ? "Usually 5–20 seconds" : `${formatNumber(user.credits)} credits left`}
          </span>
        </div>
      </div>
    );
  } else if (phase === "result" && note.trim()) {
    controls = (
      <p className="px-1 text-[13px] text-orza-muted">
        Your note: <span className="text-orza-strong">&ldquo;{note.trim()}&rdquo;</span>
      </p>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-20">
      <PageHeader
        eyebrow="Snap & Know"
        title="Snap your plate. Know your meal."
        description="Photograph your meal — AI instantly estimates calories, protein, carbs, and fat from any global cuisine. Review it, fix anything, then log."
        actions={
          <ButtonLink href={mealsHref} variant="secondary" size="sm" className="h-10">
            <UtensilsCrossed size={15} strokeWidth={1.75} aria-hidden /> Meal log
          </ButtonLink>
        }
      />

      {!isToday && (
        <div className="mb-6 flex items-center gap-2 rounded-orza-sm border border-[rgba(135,87,242,0.22)] bg-[rgba(135,87,242,0.06)] px-3.5 py-2.5 text-[13px] text-[#5630A8]">
          <CalendarClock size={15} strokeWidth={1.75} className="shrink-0" aria-hidden />
          <span>
            Scans will be logged to <strong className="font-semibold">{dayLabel}</strong>.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <div className="lg:sticky lg:top-8">
          <ScanViewfinder image={image} phase={phase} confidence={scan?.confidence} dishName={scan?.dish_name}>
            {controls}
          </ScanViewfinder>
          {/* Hidden pickers: camera-first on phones, file browser everywhere. */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onFile}
          />
          <input ref={uploadRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onFile} />
        </div>
        <div id="scan-review" className="scroll-mt-20">
          {side}
        </div>
      </div>

      <WellnessNote className="mt-10 text-center" />
    </div>
  );
}
