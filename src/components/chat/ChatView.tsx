"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowDown, MessagesSquare, RotateCcw, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/ui";
import { useUser } from "@/components/app/UserProvider";
import { GlassCard } from "@/components/orza/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ChatEmptyState } from "./ChatEmptyState";
import { CHAT_FRAME } from "./ChatSkeleton";
import { Composer, MAX_MESSAGE } from "./Composer";
import { AssistantBubble, DaySeparator, TypingIndicator, UserBubble } from "./MessageBubble";
import { OrzaOrb } from "./OrzaOrb";
import { QUICK_ACTIONS, type QuickAction, type StarterPrompt } from "./prompts";
import { SessionList } from "./SessionList";
import { dayKey, dayLabel } from "./format";
import type { ChatSession, HistoryResponse, SendResponse, SessionsResponse, UIMessage } from "./types";

/** An in-flight send. `view` identifies the conversation view it was sent from. */
type Pending = { view: number; sessionId: string | null; tempId: string };

/** Keep ?session= in the address bar in sync without a navigation. */
function syncUrl(sessionId: string | null) {
  try {
    const url = new URL(window.location.href);
    if (sessionId) url.searchParams.set("session", sessionId);
    else url.searchParams.delete("session");
    url.searchParams.delete("q");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  } catch {
    /* non-critical */
  }
}

const finePointer = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: fine)").matches;

/**
 * "Ask ÖRZA": sessions list (side pane on desktop, drawer on mobile) + conversation + composer.
 * Opens ?session= (or today's latest conversation), otherwise a fresh chat with starter prompts.
 */
export function ChatView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { user, setUser, setCredits } = useUser();

  const [sessions, setSessions] = React.useState<ChatSession[] | null>(null);
  const [sessionsError, setSessionsError] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<UIMessage[]>([]);
  const [historyState, setHistoryState] = React.useState<"idle" | "loading" | "error">("idle");
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [view, setView] = React.useState(0);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<ChatSession | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [showJump, setShowJump] = React.useState(false);

  // Refs mirror state for async callbacks.
  const activeRef = React.useRef<string | null>(null);
  const viewRef = React.useRef(0);
  const pendingRef = React.useRef<Pending | null>(null);
  const historyReq = React.useRef(0);
  const startedRef = React.useRef(false);
  /** The user has sent something in this visit — first-load auto-open must not replace it. */
  const sentRef = React.useRef(false);
  const userRef = React.useRef(user);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const stickRef = React.useRef(true);
  const pendingScroll = React.useRef<ScrollBehavior | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  const firstName = (user.name || "").trim().split(/\s+/)[0] || "";
  const activeSession = sessions?.find((s) => s.id === activeId) || null;
  const showTyping = !!pending && (pending.view === view || (!!pending.sessionId && pending.sessionId === activeId));

  const bumpView = React.useCallback(() => {
    viewRef.current += 1;
    setView(viewRef.current);
  }, []);

  const focusComposer = React.useCallback((force = false) => {
    if (force || finePointer()) requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  /* ───────── scrolling ───────── */

  const scrollToBottom = React.useCallback(
    (behavior: ScrollBehavior) => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : behavior });
    },
    [reduceMotion]
  );

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    stickRef.current = near;
    setShowJump(!near);
  }, []);

  React.useEffect(() => {
    const wanted = pendingScroll.current;
    pendingScroll.current = null;
    if (wanted) scrollToBottom(wanted);
    else if (stickRef.current) scrollToBottom("smooth");
  }, [messages, showTyping, scrollToBottom]);

  /* ───────── sessions & history ───────── */

  const loadSessions = React.useCallback(async (): Promise<ChatSession[] | null> => {
    setSessionsError(null);
    try {
      const r = await api.get<SessionsResponse>("/chat/sessions");
      setSessions(r.sessions);
      return r.sessions;
    } catch (e) {
      setSessionsError(errorMessage(e));
      setSessions((s) => s ?? []);
      return null;
    }
  }, []);

  const startNew = React.useCallback(() => {
    bumpView();
    historyReq.current += 1;
    activeRef.current = null;
    setActiveId(null);
    setMessages([]);
    setHistoryState("idle");
    setDrawerOpen(false);
    setShowJump(false);
    stickRef.current = true;
    syncUrl(null);
    focusComposer();
  }, [bumpView, focusComposer]);

  const openSession = React.useCallback(
    async (id: string, force = false) => {
      setDrawerOpen(false);
      if (!force && id === activeRef.current) return;
      bumpView();
      activeRef.current = id;
      setActiveId(id);
      setMessages([]);
      setHistoryState("loading");
      setShowJump(false);
      stickRef.current = true;
      syncUrl(id);
      const req = ++historyReq.current;
      try {
        const res = await api.get<HistoryResponse>(`/chat/history?session_id=${encodeURIComponent(id)}`);
        if (req !== historyReq.current) return;
        const meals = res.logged_meals || {};
        setMessages(
          res.messages.map((m) => ({ ...m, loggedMeal: m.meta?.logged_meal_id ? meals[m.meta.logged_meal_id] ?? null : null }))
        );
        setHistoryState("idle");
        pendingScroll.current = "auto";
      } catch (e) {
        if (req !== historyReq.current) return;
        if (e instanceof ApiError && e.status === 404) {
          toast.error("That conversation isn't available any more.");
          setSessions((list) => (list ? list.filter((s) => s.id !== id) : list));
          startNew();
          return;
        }
        setHistoryState("error");
      }
    },
    [bumpView, startNew]
  );

  // First load: sessions, then ?session= or today's most recent conversation. Guarded for StrictMode.
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const wanted = searchParams.get("session");
    const q = searchParams.get("q");
    if (q) setInput(q.slice(0, MAX_MESSAGE));
    void (async () => {
      const list = await loadSessions();
      // The user already started something (a send in flight, a reply or a failed message on screen, another chat).
      if (viewRef.current !== 0 || activeRef.current || pendingRef.current || sentRef.current) return;
      const latest = list?.[0];
      const target = wanted || (latest && dayKey(latest.updated_at) === dayKey(new Date().toISOString()) ? latest.id : null);
      if (target) void openSession(target);
      else focusComposer();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── sending ───────── */

  const send = React.useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pendingRef.current) return;
      if (text.length > MAX_MESSAGE) {
        toast.error("Please keep messages under 2,000 characters.");
        return;
      }
      const p: Pending = { view: viewRef.current, sessionId: activeRef.current, tempId: `tmp-${Date.now()}` };
      pendingRef.current = p;
      sentRef.current = true;
      setPending(p);
      setInput("");
      stickRef.current = true;
      pendingScroll.current = "smooth";
      setMessages((ms) => [
        ...ms,
        {
          id: p.tempId,
          session_id: p.sessionId ?? "",
          user_id: userRef.current.id,
          role: "user",
          content: text,
          created_at: new Date().toISOString(),
          status: "sending",
          fresh: true,
        },
      ]);

      try {
        const res = await api.post<SendResponse>("/chat/send", p.sessionId ? { message: text, session_id: p.sessionId } : { message: text });

        // Memory first (full user object), then credits (functional update) so neither overwrites the other.
        if (res.memory || res.allergies) {
          const u = userRef.current;
          setUser({
            ...u,
            ...(res.memory ? { memory: res.memory } : {}),
            ...(res.allergies ? { profile: { ...(u.profile || {}), allergies: res.allergies } } : {}),
          });
        }
        if (typeof res.credits === "number") setCredits(res.credits);

        if (res.session) {
          const s = res.session;
          setSessions((list) => [s, ...(list ?? []).filter((x) => x.id !== s.id)]);
          setSessionsError(null);
        } else {
          void loadSessions();
        }

        const here = viewRef.current === p.view || activeRef.current === res.session_id;
        if (!here) return;
        if (activeRef.current !== res.session_id) {
          activeRef.current = res.session_id;
          setActiveId(res.session_id);
          syncUrl(res.session_id);
        }
        const userMsg: UIMessage = { ...res.user_message, fresh: false };
        const reply: UIMessage = { ...res.message, loggedMeal: res.logged_meal ?? null, notice: res.notice, fresh: true };
        setMessages((ms) => {
          const ids = new Set(ms.map((m) => m.id));
          let next = ms.some((m) => m.id === p.tempId)
            ? ms.map((m) => (m.id === p.tempId ? userMsg : m))
            : ids.has(userMsg.id)
              ? ms
              : [...ms, userMsg];
          if (!ids.has(reply.id)) next = [...next, reply];
          return next;
        });
      } catch (e) {
        setMessages((ms) => ms.map((m) => (m.id === p.tempId ? { ...m, status: "failed" } : m)));
        if (e instanceof ApiError && e.status === 402) {
          toast.error(e.message, {
            duration: 10000,
            action: { label: "Get credits", onClick: () => router.push("/dashboard/credits") },
          });
        } else if (e instanceof ApiError && e.status === 404 && p.sessionId) {
          toast.error("This conversation was deleted. Start a new chat to keep going.");
          setSessions((list) => (list ? list.filter((s) => s.id !== p.sessionId) : list));
        } else {
          toast.error(errorMessage(e));
        }
      } finally {
        pendingRef.current = null;
        setPending(null);
        focusComposer();
      }
    },
    [focusComposer, loadSessions, router, setCredits, setUser]
  );

  const retry = React.useCallback(
    (m: UIMessage) => {
      if (pendingRef.current) return;
      setMessages((ms) => ms.filter((x) => x.id !== m.id));
      void send(m.content);
    },
    [send]
  );

  /** Drop text into the composer (without overwriting a draft) and put the caret at the end. */
  function prefillComposer(text: string) {
    setInput((cur) => (cur.trim() ? cur : text));
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  function runQuickAction(a: QuickAction) {
    if (a.prompt) void send(a.prompt);
    else if (a.prefill) prefillComposer(a.prefill);
  }

  /** Questions send straight away; meal statements only fill the composer, so an example never logs a meal. */
  function pickStarter(s: StarterPrompt) {
    if (s.send) void send(s.text);
    else prefillComposer(s.text);
  }

  /* ───────── deleting ───────── */

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setDeleting(true);
    try {
      await api.del(`/chat/sessions/${encodeURIComponent(target.id)}`);
      setSessions((list) => (list ? list.filter((s) => s.id !== target.id) : list));
      if (activeRef.current === target.id) startNew();
      setPendingDelete(null);
      toast.success("Conversation deleted");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setSessions((list) => (list ? list.filter((s) => s.id !== target.id) : list));
        if (activeRef.current === target.id) startNew();
        setPendingDelete(null);
      } else {
        toast.error(errorMessage(e));
      }
    } finally {
      setDeleting(false);
    }
  }

  const requestDelete = (s: ChatSession) => {
    setDrawerOpen(false);
    setPendingDelete(s);
  };

  const retrySessions = () => {
    setSessions(null);
    void loadSessions();
  };

  /* ───────── render ───────── */

  const busy = !!pending;
  const memoryCount = Array.isArray(user.memory) ? user.memory.length : 0;
  const listProps = {
    sessions,
    error: sessionsError,
    activeId,
    memoryCount,
    onSelect: (id: string) => void openSession(id),
    onNew: startNew,
    onDelete: requestDelete,
    onRetry: retrySessions,
  };

  let body: React.ReactNode;
  if (historyState === "loading") {
    body = (
      <div className="flex flex-col gap-4 pt-2" aria-label="Loading conversation">
        <div className="orza-skeleton h-12 w-[55%] self-end rounded-orza-md" />
        <div className="orza-skeleton h-28 w-[78%] rounded-orza-md" />
        <div className="orza-skeleton h-10 w-[40%] self-end rounded-orza-md" />
        <div className="orza-skeleton h-20 w-[66%] rounded-orza-md" />
      </div>
    );
  } else if (historyState === "error") {
    body = (
      <EmptyState
        className="my-auto"
        icon={<AlertCircle className="h-5 w-5" aria-hidden />}
        title="Couldn't load this conversation"
        description="Check your connection and try again — your messages are safe."
        action={
          <Button variant="secondary" onClick={() => activeId && void openSession(activeId, true)}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </Button>
        }
      />
    );
  } else if (!messages.length && !showTyping) {
    body = <ChatEmptyState firstName={firstName} onPick={pickStarter} onQuickAction={runQuickAction} disabled={busy} />;
  } else {
    body = (
      <div role="log" aria-live="polite" aria-label="Conversation with ÖRZA" className="flex flex-col gap-4">
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          return (
            <React.Fragment key={m.id}>
              {newDay && <DaySeparator label={dayLabel(m.created_at)} />}
              {m.role === "user" ? <UserBubble message={m} onRetry={busy ? undefined : retry} /> : <AssistantBubble message={m} />}
            </React.Fragment>
          );
        })}
        {showTyping && <TypingIndicator />}
      </div>
    );
  }

  return (
    <>
      <div className={CHAT_FRAME}>
        {/* Desktop: conversations pane */}
        <GlassCard as="aside" variant="subtle" padded={false} aria-label="Conversations" className="hidden w-[280px] shrink-0 flex-col overflow-hidden xl:flex">
          <SessionList {...listProps} />
        </GlassCard>

        {/* Conversation */}
        <GlassCard as="section" padded={false} aria-label="Ask ÖRZA" className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-[rgba(20,20,20,0.08)] bg-white/40 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <OrzaOrb size={36} />
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 font-editorial text-[17px] font-semibold leading-6 text-orza-strong">
                  Ask ÖRZA
                  <span className="h-1.5 w-1.5 rounded-full bg-[#127A56]" aria-hidden />
                </h1>
                <p className="truncate text-xs text-orza-muted">{activeSession?.title || "Your wellness companion"}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="mr-2 hidden font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle 2xl:inline">
                English · हिंदी · Hinglish
              </span>
              <Button variant="secondary" size="sm" className="px-3 xl:hidden" onClick={() => setDrawerOpen(true)}>
                <MessagesSquare className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">Chats</span>
              </Button>
              <Button variant="secondary" size="icon" className="h-9 w-9 xl:hidden" onClick={startNew} aria-label="New chat" title="New chat">
                <SquarePen className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </header>

          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain">
              <div className="mx-auto flex min-h-full w-full max-w-[780px] flex-col px-4 py-5 sm:px-6 sm:py-6">{body}</div>
            </div>
            {showJump && messages.length > 0 && historyState === "idle" && (
              <button
                type="button"
                onClick={() => {
                  stickRef.current = true;
                  scrollToBottom("smooth");
                }}
                className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/90 px-3.5 py-1.5 text-xs font-medium text-orza-strong shadow-orza-floating backdrop-blur-orza transition-colors duration-150 ease-orza hover:bg-white"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden /> Latest
              </button>
            )}
          </div>

          <div className="border-t border-[rgba(20,20,20,0.08)] bg-[rgba(251,247,241,0.6)] px-3 pb-3 pt-3 sm:px-5 sm:pb-4">
            <div className="mx-auto w-full max-w-[780px]">
              {messages.length > 0 && historyState === "idle" && (
                <div className="-mx-1 mb-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar" aria-label="Quick actions">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      disabled={busy && !!a.prompt}
                      onClick={() => runQuickAction(a)}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 px-3 text-xs text-orza-strong",
                        "transition-[background-color,transform] duration-220 ease-orza hover:-translate-y-[1px] hover:bg-white/90 disabled:pointer-events-none disabled:opacity-50"
                      )}
                    >
                      <a.icon className="h-3.5 w-3.5 text-[#0B8FA6]" strokeWidth={1.75} aria-hidden />
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              <Composer
                value={input}
                onChange={setInput}
                onSend={() => void send(input)}
                busy={busy}
                textareaRef={textareaRef}
                defaultVoiceLang={user.profile?.language === "hi" ? "hi-IN" : "en-IN"}
              />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Mobile / tablet: conversations drawer */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent side="right" title="Conversations" description="Pick up where you left off, or start fresh.">
          <SessionList {...listProps} inDrawer />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}>
        <DialogContent
          title="Delete this conversation?"
          description={
            pendingDelete
              ? `“${pendingDelete.title || "New chat"}” and its messages will be removed. Meals ÖRZA logged stay in your meal log.`
              : undefined
          }
        >
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="danger" loading={deleting} onClick={() => void confirmDelete()}>
              Delete conversation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
