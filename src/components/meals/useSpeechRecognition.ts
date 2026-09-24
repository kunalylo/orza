"use client";
import * as React from "react";

/* Minimal typings — the Web Speech API isn't in TypeScript's DOM lib. */
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings, or type instead.",
  "service-not-allowed": "Voice input isn't allowed in this browser. You can type your meal instead.",
  "no-speech": "Didn't catch that — tap the mic and try again, a little closer.",
  "audio-capture": "No microphone found. Plug one in or type your meal instead.",
  network: "Voice input needs an internet connection. Please check it and try again.",
  "language-not-supported": "That language isn't available for voice here — try English (India).",
};

/**
 * Browser speech-to-text (Chrome, Edge, Safari). One utterance per start(); final text is
 * delivered through `onFinal`, live partial text through `interim`.
 * `supported` is null until mounted (avoids SSR/hydration mismatches).
 */
export function useSpeechRecognition({ lang, onFinal }: { lang: string; onFinal: (text: string) => void }) {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const recRef = React.useRef<Recognition | null>(null);
  const onFinalRef = React.useRef(onFinal);

  React.useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  React.useEffect(() => {
    setSupported(!!getCtor());
    return () => recRef.current?.abort();
  }, []);

  const start = React.useCallback(() => {
    const Ctor = getCtor();
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
  /** Stop without delivering any pending text (e.g. when the form is submitted). */
  const cancel = React.useCallback(() => recRef.current?.abort(), []);
  const clearError = React.useCallback(() => setError(null), []);

  return { supported, listening, interim, error, start, stop, cancel, clearError };
}
