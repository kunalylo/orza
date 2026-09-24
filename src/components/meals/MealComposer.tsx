"use client";
import * as React from "react";
import { toast } from "sonner";
import { ListPlus, Mic, MicOff, Sparkles, Square } from "lucide-react";
import type { MealType } from "@/lib/types";
import { api, errorMessage } from "@/lib/api-client";
import { cn, formatNumber } from "@/lib/utils";
import { Eyebrow, GlassCard, IconTile } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Segmented, Textarea } from "@/components/ui/form";
import { useUser } from "@/components/app/UserProvider";
import { useSpeechRecognition } from "./useSpeechRecognition";
import type { AiStatus } from "./useAiStatus";
import { FALLBACK_COSTS, MEAL_SINGULAR, MEAL_TYPES, type TextLogResponse } from "./meal-utils";

const MAX_CHARS = 500;

/** Real sentences people type — English, Hindi and Hinglish, with Indian portions. */
const EXAMPLES = [
  "Aaj maine breakfast mein do paratha aur dahi khaya",
  "2 roti, 1 katori dal and half plate rice",
  "aaj poha aur chai",
  "Masala dosa from a restaurant",
  "Ek katori rajma aur ek plate chawal",
];

const LANGS = [
  { value: "en-IN", label: "English" },
  { value: "hi-IN", label: "हिंदी" },
] as const;
type Lang = (typeof LANGS)[number]["value"];
const LANG_KEY = "orza.voiceLang";

export type ComposerMealType = MealType | "auto";

/** "Tell ÖRZA what you ate" — type or speak a meal, ÖRZA parses and logs it. */
export function MealComposer({
  date,
  mealType,
  onMealTypeChange,
  aiStatus,
  onLogged,
  onOpenFoodList,
  className,
}: {
  date: string;
  mealType: ComposerMealType;
  onMealTypeChange: (t: ComposerMealType) => void;
  aiStatus: AiStatus | null;
  onLogged: (res: TextLogResponse) => void;
  onOpenFoodList: () => void;
  className?: string;
}) {
  const { user, setCredits } = useUser();
  const [text, setText] = React.useState("");
  const [lang, setLang] = React.useState<Lang>("en-IN");
  const [submitting, setSubmitting] = React.useState(false);
  const [voiceNote, setVoiceNote] = React.useState<string | null>(null);
  const usedVoice = React.useRef(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const hintId = React.useId();

  // Remember the voice language per browser (Hindi speakers shouldn't have to switch every time).
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "en-IN" || saved === "hi-IN") setLang(saved);
      else if (user.profile?.language === "hi") setLang("hi-IN");
    } catch {
      /* storage unavailable */
    }
  }, [user.profile?.language]);

  const chooseLang = (l: Lang) => {
    setLang(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const onFinal = React.useCallback((heard: string) => {
    usedVoice.current = true;
    setText((prev) => {
      const joined = prev.trim() ? `${prev.trimEnd()} ${heard}` : heard;
      return joined.slice(0, MAX_CHARS);
    });
  }, []);

  const speech = useSpeechRecognition({ lang, onFinal });

  const toggleMic = () => {
    if (speech.supported === false) {
      setVoiceNote("Voice input isn't available in this browser. Try Chrome, Edge or Safari — or simply type your meal.");
      return;
    }
    setVoiceNote(null);
    if (speech.listening) speech.stop();
    else speech.start();
  };

  const submit = async () => {
    const value = text.trim();
    if (submitting) return;
    if (value.length < 2) {
      toast.error("Tell ÖRZA what you ate — e.g. “2 roti and 1 katori dal”.");
      textRef.current?.focus();
      return;
    }
    if (speech.listening) speech.cancel();
    setSubmitting(true);
    try {
      const res = await api.post<TextLogResponse>("/meals/text", {
        text: value,
        date,
        meal_type: mealType === "auto" ? undefined : mealType,
        source: usedVoice.current ? "voice" : "text",
      });
      if (typeof res.credits === "number") setCredits(res.credits);
      const t = res.meal.meal_type;
      toast.success(`Logged to ${MEAL_SINGULAR[t].toLowerCase()} — ${formatNumber(res.meal.totals.calories)} kcal`);
      setText("");
      usedVoice.current = false;
      onLogged(res);
    } catch (e) {
      toast.error(errorMessage(e));
      textRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter logs, Shift+Enter adds a line. Never submit mid-composition (Hindi/Indic IMEs).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const applyExample = (ex: string) => {
    usedVoice.current = false;
    setText(ex);
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(ex.length, ex.length);
    });
  };

  const cost = aiStatus?.costs?.meal_text ?? FALLBACK_COSTS.meal_text;
  const costHint =
    aiStatus == null
      ? null
      : aiStatus.ai_enabled
        ? `AI estimate · ${cost} credit${cost === 1 ? "" : "s"} · ${formatNumber(user.credits)} left`
        : "Free · ÖRZA's built-in Indian food list";

  const micLabel = speech.listening ? "Stop listening" : "Speak your meal";

  return (
    <GlassCard as="section" variant="strong" className={cn("relative overflow-hidden", className)} aria-labelledby="composer-title">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-28 -top-32 h-72 w-72 rounded-full opacity-70 blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(255,180,84,0.22) 0%, rgba(255,122,106,0.12) 45%, rgba(255,95,162,0) 70%)" }}
      />
      <div className="relative">
        <div className="flex items-start gap-3.5">
          <IconTile tone="energy" className="mt-0.5">
            <Sparkles size={17} strokeWidth={1.75} aria-hidden />
          </IconTile>
          <div className="min-w-0">
            <Eyebrow className="text-[11px]">Type or speak</Eyebrow>
            <h2 id="composer-title" className="mt-1 font-editorial text-[24px] font-semibold leading-8 tracking-[-0.01em] text-orza-strong sm:text-[26px]">
              Tell ÖRZA what you ate
            </h2>
            <p className="mt-1 text-[14px] leading-relaxed text-orza-muted">
              In English, Hindi or Hinglish — &ldquo;ek katori&rdquo;, &ldquo;half plate&rdquo;, &ldquo;do roti&rdquo; all work.
            </p>
          </div>
        </div>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label htmlFor="meal-text" className="sr-only">
            What did you eat?
          </label>
          <div className="relative">
            <Textarea
              id="meal-text"
              ref={textRef}
              value={text}
              rows={3}
              maxLength={MAX_CHARS}
              onChange={(e) => {
                setText(e.target.value);
                if (!e.target.value.trim()) usedVoice.current = false;
              }}
              onKeyDown={onKeyDown}
              readOnly={submitting}
              aria-describedby={hintId}
              placeholder={speech.listening ? "Listening…" : "“aaj poha aur chai” or “2 roti with dal”"}
              className="min-h-[108px] resize-none pb-9 pr-4 text-[16px] sm:text-[15px]"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3.5 font-mono text-[10px] tabular-nums text-orza-subtle" aria-hidden>
              {text.length}/{MAX_CHARS}
            </span>
          </div>

          {/* Voice row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={toggleMic}
              aria-label={micLabel}
              aria-pressed={speech.listening}
              title={speech.supported === false ? "Voice input isn't supported in this browser" : micLabel}
              disabled={submitting}
              className={cn(
                "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-[background-color,color,box-shadow] duration-220 ease-orza disabled:opacity-50",
                speech.listening
                  ? "border-transparent bg-orza-energy text-white shadow-[0_10px_30px_rgba(255,122,106,0.40)]"
                  : speech.supported === false
                    ? "border-[rgba(20,20,20,0.10)] bg-white/60 text-orza-subtle"
                    : "border-[rgba(20,20,20,0.12)] bg-white/85 text-orza-strong hover:bg-white hover:shadow-orza-glass"
              )}
            >
              {speech.listening && (
                <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[rgba(255,122,106,0.35)] [animation-duration:1.6s]" />
              )}
              {speech.listening ? (
                <Square size={14} strokeWidth={2.25} className="relative fill-current" aria-hidden />
              ) : speech.supported === false ? (
                <MicOff size={18} strokeWidth={1.75} aria-hidden />
              ) : (
                <Mic size={18} strokeWidth={1.75} aria-hidden />
              )}
            </button>
            <div role="group" aria-label="Voice language">
              <Segmented size="sm" value={lang} onChange={chooseLang} options={LANGS.map((l) => ({ value: l.value, label: l.label }))} />
            </div>
            <div className="min-w-0 flex-1 basis-full text-[13px] sm:basis-auto" aria-live="polite">
              {speech.listening ? (
                <span className="flex items-center gap-2 text-orza-strong">
                  <span className="inline-flex h-2 w-2 shrink-0 animate-orza-pulse rounded-full bg-[#FF7A6A]" aria-hidden />
                  <span className="truncate">{speech.interim ? <em className="not-italic text-orza-muted">{speech.interim}</em> : "Listening — speak now"}</span>
                </span>
              ) : speech.error ? (
                <span className="text-[#B06A00]">{speech.error}</span>
              ) : voiceNote ? (
                <span className="text-[#B06A00]">{voiceNote}</span>
              ) : (
                <span className="text-orza-subtle">
                  {speech.supported === false ? "Voice needs Chrome, Edge or Safari — typing works everywhere." : "Tap the mic and say it the way you would to a friend."}
                </span>
              )}
            </div>
          </div>

          {/* Examples */}
          <div className="mt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Try saying</div>
            <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => applyExample(ex)}
                  disabled={submitting}
                  className="h-8 shrink-0 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/70 px-3.5 text-[13px] text-orza-muted transition-colors duration-150 ease-orza hover:border-[rgba(255,122,106,0.35)] hover:bg-[#FFF7F2] hover:text-orza-strong disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Meal type + actions */}
          <div className="mt-5 flex flex-col gap-4 border-t border-[rgba(20,20,20,0.08)] pt-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <span className="mb-1.5 block text-[13px] font-medium text-orza-strong" id="composer-meal-type">
                Meal
              </span>
              <div role="group" aria-labelledby="composer-meal-type" className="no-scrollbar -mx-1 overflow-x-auto px-1">
                <Segmented
                  size="sm"
                  value={mealType}
                  onChange={onMealTypeChange}
                  options={[
                    { value: "auto" as ComposerMealType, label: "Auto" },
                    ...MEAL_TYPES.map((t) => ({ value: t as ComposerMealType, label: MEAL_SINGULAR[t] })),
                  ]}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {costHint && (
                <span id={hintId} className="order-last text-center text-[12px] text-orza-subtle sm:order-first sm:mr-1 sm:text-right">
                  {costHint}
                </span>
              )}
              <Button type="button" variant="secondary" onClick={onOpenFoodList} disabled={submitting}>
                <ListPlus size={15} strokeWidth={1.75} aria-hidden /> Add from food list
              </Button>
              <Button type="submit" loading={submitting} disabled={!text.trim()}>
                {submitting ? "Understanding…" : "Log meal"}
              </Button>
            </div>
          </div>
          {!costHint && <span id={hintId} className="sr-only">Press Enter to log, Shift and Enter for a new line.</span>}
        </form>
      </div>
    </GlassCard>
  );
}
