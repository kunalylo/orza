"use client";
import * as React from "react";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { WellnessNote } from "@/components/app/ui";
import { cn, formatNumber } from "@/lib/utils";
import { useVoiceInput, type VoiceLang } from "./useVoiceInput";

export const MAX_MESSAGE = 2000;
const VOICE_KEY = "orza.chat.voiceLang";
const VOICE_LABEL: Record<VoiceLang, { short: string; long: string }> = {
  "en-IN": { short: "EN", long: "English (India)" },
  "hi-IN": { short: "हिंदी", long: "Hindi" },
};

/**
 * Chat composer: autosizing textarea (Enter sends, Shift+Enter adds a line),
 * Web Speech mic (en-IN / hi-IN) that drops the transcript in for review, and the send button.
 */
export function Composer({
  value,
  onChange,
  onSend,
  busy,
  textareaRef,
  defaultVoiceLang = "en-IN",
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  busy: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  defaultVoiceLang?: VoiceLang;
}) {
  const [voiceLang, setVoiceLang] = React.useState<VoiceLang>(defaultVoiceLang);
  const valueRef = React.useRef(value);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Remembered per browser — a convenience only.
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VOICE_KEY);
      if (saved === "en-IN" || saved === "hi-IN") setVoiceLang(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const onFinal = React.useCallback(
    (text: string) => {
      const cur = valueRef.current;
      const next = cur && !/\s$/.test(cur) ? `${cur} ${text}` : cur + text;
      onChange(next.slice(0, MAX_MESSAGE));
      textareaRef.current?.focus();
    },
    [onChange, textareaRef]
  );
  const voice = useVoiceInput({ lang: voiceLang, onFinal });

  React.useEffect(() => {
    if (!voice.error) return;
    toast.error(voice.error);
    voice.clearError();
  }, [voice.error, voice.clearError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosize up to ~6 lines, then scroll inside.
  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value, textareaRef]);

  const canSend = !!value.trim() && !busy && value.length <= MAX_MESSAGE;

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && voice.listening) {
      voice.stop();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  function toggleMic() {
    if (voice.supported === false) {
      toast.info("Voice input isn't supported in this browser — try Chrome, Edge or Safari, or type your message.");
      return;
    }
    if (voice.listening) voice.stop();
    else voice.start();
  }

  function switchLang() {
    const next: VoiceLang = voiceLang === "en-IN" ? "hi-IN" : "en-IN";
    if (voice.listening) voice.stop();
    setVoiceLang(next);
    try {
      window.localStorage.setItem(VOICE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }

  const other: VoiceLang = voiceLang === "en-IN" ? "hi-IN" : "en-IN";

  return (
    <div>
      {voice.listening && (
        <div className="mb-2 flex min-w-0 items-center gap-2 px-1 text-xs text-orza-muted" aria-live="polite">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orza-coral opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orza-coral" />
          </span>
          <span className="shrink-0">Listening · {VOICE_LABEL[voiceLang].long}</span>
          {voice.interim && <span className="min-w-0 truncate italic text-orza-subtle">{voice.interim}</span>}
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-1.5 rounded-[24px] border border-[rgba(20,20,20,0.12)] bg-white/85 p-1.5 shadow-[0_8px_24px_rgba(20,20,20,0.06)] backdrop-blur-orza",
          "transition-[border-color,box-shadow] duration-150 ease-orza focus-within:border-orza-cyan focus-within:shadow-[0_0_0_3px_rgba(11,190,220,0.18)]"
        )}
      >
        <button
          type="button"
          onClick={toggleMic}
          aria-label={voice.listening ? "Stop listening" : `Speak your message (${VOICE_LABEL[voiceLang].long})`}
          aria-pressed={voice.listening}
          aria-disabled={voice.supported === false || undefined}
          title={voice.supported === false ? "Voice input isn't supported in this browser" : undefined}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[background-color,color,box-shadow] duration-150 ease-orza",
            voice.listening
              ? "bg-orza-energy text-white shadow-[0_8px_24px_rgba(255,122,106,0.40)]"
              : "text-orza-muted hover:bg-[rgba(20,20,20,0.05)] hover:text-orza-strong",
            voice.supported === false && "opacity-50"
          )}
        >
          {voice.listening ? <Square className="h-3.5 w-3.5 fill-current" aria-hidden /> : <Mic className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />}
        </button>

        <label htmlFor="orza-chat-input" className="sr-only">
          Message ÖRZA
        </label>
        <textarea
          id="orza-chat-input"
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_MESSAGE}
          enterKeyHint="send"
          autoComplete="off"
          placeholder={voice.listening ? "Listening…" : "Aaj kya khaya? Ask me anything…"}
          className="max-h-[168px] min-h-[36px] flex-1 resize-none bg-transparent px-1 py-[7px] text-[15px] leading-[22px] text-orza-strong placeholder:text-orza-subtle focus:outline-none focus-visible:shadow-none"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0BBEDC] text-[#062A31] shadow-[0_8px_22px_rgba(11,190,220,0.30)] transition-[background-color,opacity,box-shadow] duration-150 ease-orza hover:bg-[#2FD2F0] disabled:bg-[rgba(20,20,20,0.08)] disabled:text-orza-subtle disabled:shadow-none"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />}
        </button>
      </div>

      <div className="mt-2 flex items-start justify-between gap-3 px-1">
        <WellnessNote className="text-[11px]" />
        <div className="flex shrink-0 items-center gap-3">
          {value.length > MAX_MESSAGE - 400 && (
            <span className={cn("font-mono text-[10px] tabular-nums", value.length >= MAX_MESSAGE ? "text-[#B02C2C]" : "text-orza-subtle")}>
              {formatNumber(value.length)}/{formatNumber(MAX_MESSAGE)}
            </span>
          )}
          {voice.supported && (
            <button
              type="button"
              onClick={switchLang}
              aria-label={`Voice language: ${VOICE_LABEL[voiceLang].long}. Switch to ${VOICE_LABEL[other].long}.`}
              className="rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-orza-muted transition-colors duration-150 ease-orza hover:bg-white hover:text-orza-strong"
            >
              Voice · {VOICE_LABEL[voiceLang].short}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
