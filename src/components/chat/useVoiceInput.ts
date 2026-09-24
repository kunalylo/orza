"use client";
import * as React from "react";

/* The Web Speech API isn't in TypeScript's DOM lib — minimal typings. */
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognizerCtor = new () => SpeechRecognizer;

function recognizerCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type VoiceLang = "en-IN" | "hi-IN";

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings, or type instead.",
  "service-not-allowed": "Voice input isn't available in this browser. You can type your message instead.",
  "no-speech": "Didn't catch that — tap the mic and try again.",
  "audio-capture": "No microphone found. Connect one, or type your message instead.",
  network: "Voice input needs an internet connection. Please check it and try again.",
  "language-not-supported": "That voice language isn't available here — try English (India).",
};

/**
 * Browser speech-to-text for the composer (Chrome, Edge, Safari).
 * One utterance per start(); final text goes to `onFinal`, live partial text is `interim`.
 * `supported` is null until mounted so server and client render the same markup.
 */
export function useVoiceInput({ lang, onFinal }: { lang: VoiceLang; onFinal: (text: string) => void }) {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const recRef = React.useRef<SpeechRecognizer | null>(null);
  const onFinalRef = React.useRef(onFinal);

  React.useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  React.useEffect(() => {
    setSupported(!!recognizerCtor());
    return () => recRef.current?.abort();
  }, []);

  const start = React.useCallback(() => {
    const Ctor = recognizerCtor();
    if (!Ctor || recRef.current) return;
    setError(null);
    setInterim("");
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        let finalText = "";
        let partial = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else partial += r[0].transcript;
        }
        if (finalText.trim()) onFinalRef.current(finalText.trim());
        setInterim(partial);
      };
      rec.onerror = (e) => {
        if (e.error !== "aborted") setError(ERRORS[e.error] || "Voice input stopped unexpectedly. Please try again.");
      };
      rec.onend = () => {
        recRef.current = null;
        setListening(false);
        setInterim("");
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
      setError("Couldn't start the microphone. Please try again.");
    }
  }, [lang]);

  const stop = React.useCallback(() => recRef.current?.stop(), []);
  const clearError = React.useCallback(() => setError(null), []);

  return { supported, listening, interim, error, start, stop, clearError };
}
