"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { api, errorMessage } from "@/lib/api-client";
import type { ChatLine, OnboardingAnswers, StepPrompt } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { AssistantBubble, ChatRow, ChatSkeleton, MessageText, OrzaAvatar, TypingBubble, UserBubble } from "./ChatBits";
import { Composer } from "./Composer";
import { OnboardingIntro } from "./OnboardingIntro";
import { ProgressAside } from "./ProgressAside";
import { SummaryCard } from "./SummaryCard";
import type { Answer, ChatItem, OnboardingProgress, OnboardingStatePayload, OnboardingStepResult } from "./types";

const EASE = [0.16, 1, 0.3, 1] as const;
const TYPING_MS = 520; // a beat of "typing" so replies feel conversational
const DONE_REDIRECT_MS = 1800;

let seq = 0;
const nextId = () => `m${++seq}`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function promptItem(prompt: StepPrompt, instant = false): ChatItem {
  if (prompt.summary) return { id: nextId(), role: "assistant", content: prompt.ack ?? "", summary: prompt.summary, instant };
  return { id: nextId(), role: "assistant", content: prompt.message, instant };
}

/** The browser's IANA timezone (saved with the profile so "today" follows the user's clock). */
function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function historyItems(history: ChatLine[]): ChatItem[] {
  return history.map((h) => ({ id: nextId(), role: h.role, content: h.content, instant: true }));
}

/** Full-screen conversational onboarding: ÖRZA asks, the user taps or types, the plan builds up alongside. */
export function OnboardingChat({ name }: { name: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const firstName = (name || "").trim().split(/\s+/)[0] || "";

  const [status, setStatus] = React.useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = React.useState("");
  const [items, setItems] = React.useState<ChatItem[]>([]);
  const [prompt, setPrompt] = React.useState<StepPrompt | null>(null);
  const [progress, setProgress] = React.useState<OnboardingProgress>({ index: 0, total: 14, value: 0 });
  const [answers, setAnswers] = React.useState<OnboardingAnswers>({});
  const [started, setStarted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [restarting, setRestarting] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const answerRef = React.useRef<HTMLDivElement>(null);
  /** Keep the newest message pinned in view. Only the user's own scrolling turns this off. */
  const stick = React.useRef(true);
  /** Last time the user scrolled by hand (wheel, touch, keys, scrollbar) — programmatic scrolls don't count. */
  const userScrollAt = React.useRef(0);
  const pointerDown = React.useRef(false);
  const inflight = React.useRef(false);
  const redirectTimer = React.useRef<number | null>(null);

  const goToDashboard = React.useCallback(() => {
    router.replace("/dashboard");
    router.refresh();
  }, [router]);

  /* ─── Load ─── */
  const load = React.useCallback(async () => {
    setStatus("loading");
    try {
      const data = await api.get<OnboardingStatePayload>("/onboarding");
      if (data.done || !data.prompt) {
        setDone(true);
        goToDashboard();
        return;
      }
      setItems([...historyItems(data.history), promptItem(data.prompt, true)]);
      setPrompt(data.prompt);
      setProgress(data.progress);
      setAnswers(data.answers || {});
      setStarted(data.history.length > 0 || Object.keys(data.answers || {}).length > 0);
      setStatus("ready");
    } catch (e) {
      setLoadError(errorMessage(e));
      setStatus("error");
    }
  }, [goToDashboard]);

  React.useEffect(() => {
    load();
    return () => {
      if (redirectTimer.current) window.clearTimeout(redirectTimer.current);
    };
  }, [load]);

  /* ─── Keep the newest message in view ─── */
  const scrollToEnd = React.useCallback(
    (smooth = true) => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduce ? "smooth" : "auto" });
    },
    [reduce]
  );

  React.useEffect(() => {
    if (!started) return;
    const id = window.requestAnimationFrame(() => scrollToEnd(true));
    return () => window.cancelAnimationFrame(id);
  }, [items.length, busy, started, scrollToEnd]);

  // The answer panel changes height between steps (and as chips are added), which resizes the log:
  // stay pinned to the bottom unless the user scrolled up. (New messages scroll smoothly via the effect above.)
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stick.current) scrollToEnd(false);
    });
    ro.observe(el);
    if (answerRef.current) ro.observe(answerRef.current);
    return () => ro.disconnect();
  }, [scrollToEnd, status, started]);

  const markUserScroll = React.useCallback(() => {
    userScrollAt.current = Date.now();
  }, []);

  // A scrollbar drag can end outside the log, so listen for the release on the window.
  React.useEffect(() => {
    const up = () => {
      pointerDown.current = false;
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // Smooth auto-scrolls pass through intermediate positions; only hand scrolling may unpin.
    if (!pointerDown.current && Date.now() - userScrollAt.current > 700) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  /* ─── Begin (intro → first question) ─── */
  async function begin() {
    setStarted(true);
    if (reduce) return;
    // Replay the greeting with a short typing beat.
    const greeting = items;
    setItems([]);
    setBusy(true);
    await wait(TYPING_MS);
    setItems(greeting.map((i) => ({ ...i, instant: false })));
    setBusy(false);
  }

  /* ─── Answer ─── */
  function applyResult(res: OnboardingStepResult) {
    if (res.answers) setAnswers(res.answers);
    if (res.progress) setProgress(res.progress);

    if (res.done) {
      setItems((s) => [...s, { id: nextId(), role: "assistant", content: res.reply }]);
      setPrompt(null);
      setDone(true);
      redirectTimer.current = window.setTimeout(goToDashboard, DONE_REDIRECT_MS);
      return;
    }
    const p = res.prompt;
    if (!p) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
    if (res.resync) {
      setItems([...historyItems(res.history ?? []), promptItem(p)]);
    } else if (res.restarted) {
      setItems([promptItem(p)]);
      setAnswers({});
    } else if (res.valid === false) {
      setItems((s) => [...s, { id: nextId(), role: "assistant", content: res.reply, tone: "hint" }]);
    } else {
      setItems((s) => [...s, promptItem(p)]);
    }
    setPrompt(p);
  }

  async function answer(value: Answer, display: string) {
    if (!prompt || inflight.current || done) return;
    inflight.current = true;
    const mine: ChatItem = { id: nextId(), role: "user", content: display };
    stick.current = true;
    setItems((s) => [...s, mine]);
    setBusy(true);
    try {
      const [res] = await Promise.all([
        api.post<OnboardingStepResult>("/onboarding/step", { step: prompt.step, answer: value, timezone: deviceTimeZone() }),
        wait(reduce ? 0 : TYPING_MS),
      ]);
      applyResult(res);
    } catch (e) {
      setItems((s) => s.filter((i) => i.id !== mine.id));
      toast.error(errorMessage(e));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  /* ─── Start over ─── */
  async function restart() {
    if (restarting) return;
    setRestarting(true);
    try {
      const res = await api.post<OnboardingStatePayload & { reply?: string }>("/onboarding/restart");
      if (res.done || !res.prompt) {
        goToDashboard();
        return;
      }
      stick.current = true;
      setItems([promptItem(res.prompt)]);
      setPrompt(res.prompt);
      setAnswers(res.answers || {});
      setProgress(res.progress);
      setStarted(true);
      setConfirmOpen(false);
      toast.success("Starting fresh");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRestarting(false);
    }
  }

  const total = Math.max(1, progress.total);
  const stepNo = Math.min(progress.index + 1, total);
  const pct = done ? 100 : started ? Math.round(Math.max(progress.value, 0.02) * 100) : 0;
  const canRestart = status === "ready" && started && !done && Object.keys(answers).length > 0;

  return (
    <div className="relative isolate flex h-dvh flex-col overflow-hidden bg-orza-bg-0">
      {/* Canvas: grain, warm glow top-right, cool wash bottom-left */}
      <div aria-hidden className="orza-canvas-grain pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 88% -6%, rgba(255,180,84,0.20) 0%, rgba(255,122,106,0.08) 28%, rgba(251,247,241,0) 55%)," +
            "radial-gradient(ellipse at 0% 100%, rgba(11,190,220,0.07) 0%, rgba(251,247,241,0) 50%)",
        }}
      />

      {/* Header */}
      <header className="relative z-20 shrink-0 border-b border-[rgba(20,20,20,0.08)] bg-[rgba(251,247,241,0.72)] backdrop-blur-orza">
        <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" aria-label="ÖRZA home" className="rounded-full text-orza-strong">
            <BrandMark />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {status === "ready" && started && (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle" aria-live="polite">
                {done ? "All set" : `Step ${stepNo} of ${total}`}
              </span>
            )}
            {canRestart && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)} disabled={busy} className="px-3">
                <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
                <span className="hidden sm:inline">Start over</span>
                <span className="sr-only sm:hidden">Start over</span>
              </Button>
            )}
          </div>
        </div>
        {/* Progress */}
        <div
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="absolute inset-x-0 bottom-0 h-[3px] bg-[rgba(20,20,20,0.05)]"
        >
          <div className="h-full bg-orza-energy transition-[width] duration-500 ease-orza-out" style={{ width: `${pct}%` }} />
        </div>
      </header>

      {/* Body */}
      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 gap-8 sm:px-6">
        <section aria-label="Conversation with ÖRZA" className="flex min-h-0 min-w-0 flex-1 flex-col">
          {status === "loading" && (
            <div className="flex-1 overflow-hidden px-4 pt-8 sm:px-0">
              <div className="mx-auto max-w-[680px]">
                <ChatSkeleton />
                <span className="sr-only" role="status">
                  Loading your setup…
                </span>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-1 items-center justify-center px-4">
              <div className="w-full max-w-[420px] rounded-orza-lg border border-[rgba(20,20,20,0.10)] bg-white/70 p-6 text-center shadow-orza-glass backdrop-blur-orza">
                <OrzaAvatar className="mx-auto h-10 w-10" />
                <h2 className="mt-4 font-editorial text-[22px] font-semibold text-orza-strong">We couldn&rsquo;t load your setup</h2>
                <p className="mt-2 text-[14px] text-orza-muted">{loadError || "Please check your connection and try again."}</p>
                <Button className="mt-5" onClick={load}>
                  <RefreshCw size={15} strokeWidth={1.75} aria-hidden />
                  Try again
                </Button>
              </div>
            </div>
          )}

          {status === "ready" && !started && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <OnboardingIntro firstName={firstName} onBegin={begin} />
            </div>
          )}

          {status === "ready" && started && (
            <>
              <div
                ref={scrollRef}
                onScroll={onScroll}
                onWheel={markUserScroll}
                onTouchMove={markUserScroll}
                onKeyDown={markUserScroll}
                onPointerDown={() => {
                  pointerDown.current = true;
                  markUserScroll();
                }}
                role="log"
                aria-live="polite"
                aria-relevant="additions"
                aria-label="Conversation"
                // Focusable so keyboard users can scroll the transcript (arrow keys / Page Up count as hand scrolling).
                tabIndex={0}
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-12 pt-6 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orza-cyan/40 sm:px-0 sm:pt-8"
              >
                <div className="mx-auto flex max-w-[680px] flex-col gap-4">
                  {items.map((m) =>
                    m.role === "user" ? (
                      <ChatRow key={m.id} from="user" instant={m.instant}>
                        <UserBubble>{m.content}</UserBubble>
                      </ChatRow>
                    ) : (
                      <div key={m.id} className="flex flex-col gap-3">
                        {m.content && (
                          <ChatRow from="assistant" instant={m.instant}>
                            <OrzaAvatar className="mt-0.5" />
                            <AssistantBubble tone={m.tone}>
                              <MessageText text={m.content} />
                            </AssistantBubble>
                          </ChatRow>
                        )}
                        {m.summary && (
                          <ChatRow from="assistant" instant={m.instant} className="sm:pl-[42px]">
                            <SummaryCard summary={m.summary} name={name} />
                          </ChatRow>
                        )}
                      </div>
                    )
                  )}
                  <AnimatePresence>{busy && <TypingBubble key="typing" />}</AnimatePresence>
                </div>
              </div>

              {/* Answer area */}
              <div ref={answerRef} className="relative shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-0 sm:pb-6">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[rgba(251,247,241,0.95)] to-[rgba(251,247,241,0)]"
                />
                <div className="mx-auto max-w-[680px]">
                  {done ? (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="flex flex-col items-center justify-between gap-3 rounded-orza-lg border border-[rgba(20,20,20,0.10)] bg-white/75 p-4 shadow-orza-floating backdrop-blur-orza sm:flex-row"
                    >
                      <div className="flex items-center gap-2.5 text-[14px] text-orza-muted" role="status">
                        <Loader2 size={16} className="animate-spin text-orza-coral" aria-hidden />
                        Taking you to your dashboard…
                      </div>
                      <Button variant="primary" size="sm" onClick={goToDashboard}>
                        Go now
                        <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
                      </Button>
                    </motion.div>
                  ) : prompt ? (
                    <AnimatePresence
                      mode="wait"
                      initial={false}
                      onExitComplete={() => {
                        // The next step's panel mounts now (often taller): re-pin once layout settles.
                        window.requestAnimationFrame(() => {
                          if (stick.current) scrollToEnd(false);
                        });
                      }}
                    >
                      <motion.div
                        key={prompt.step}
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className={cn(
                          "max-h-[46dvh] overflow-y-auto overscroll-contain rounded-orza-lg border border-[rgba(20,20,20,0.10)] bg-[rgba(255,255,255,0.66)] p-3 shadow-orza-floating backdrop-blur-orza sm:max-h-[40dvh] sm:p-4",
                          busy && "pointer-events-none"
                        )}
                        aria-busy={busy}
                      >
                        <Composer prompt={prompt} busy={busy} onAnswer={answer} />
                      </motion.div>
                    </AnimatePresence>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>

        {/* Desktop: the plan building up */}
        <aside aria-label="Your answers so far" className="hidden w-[300px] shrink-0 overflow-y-auto py-8 lg:block">
          {status === "ready" ? (
            <ProgressAside answers={answers} step={prompt?.step ?? null} done={done} />
          ) : (
            <div className="orza-skeleton h-[420px] w-full rounded-orza-lg" aria-hidden />
          )}
        </aside>
      </div>

      {/* Start over confirmation */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !restarting && setConfirmOpen(o)}>
        <DialogContent title="Start over?" description="Your answers so far will be cleared and we'll begin again from the first question.">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary" disabled={restarting}>
                Keep going
              </Button>
            </DialogClose>
            <Button variant="primary" loading={restarting} onClick={restart}>
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
              Start over
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
