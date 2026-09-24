"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, HeartHandshake, Languages, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, GlassCard, Tag } from "@/components/orza/primitives";

/*
 * Scripted "command center" demo for the Voice section, modelled on the ecosystem site's
 * HomeCommandCenter: tap a prompt chip (or the mic for a voice run-through) and a realistic
 * ÖRZA reply swaps in. Replies are illustrative — nothing here calls the API.
 */

type Attachment =
  | {
      kind: "log";
      meal: string;
      items: { name: string; qty: string; kcal: number }[];
      total: number;
      macros: { label: string; value: string }[];
    }
  | { kind: "plan"; title: string; days: { day: string; text: string; delta: string }[] }
  | { kind: "options"; title: string; options: { name: string; kcal: string; protein: string }[] };

type Demo = {
  id: string;
  prompt: string;
  lang: "English" | "Hinglish";
  reply: string;
  attachment: Attachment;
  followUp?: string;
};

const DEMOS: Demo[] = [
  {
    id: "paratha",
    prompt: "Aaj maine breakfast mein do paratha aur dahi khaya",
    lang: "Hinglish",
    reply:
      "Breakfast mein log kar diya! Dahi se thoda protein mil gaya — lunch mein dal ya paneer add karein toh aaj ka protein goal aaram se poora ho jayega.",
    attachment: {
      kind: "log",
      meal: "Breakfast",
      items: [
        { name: "Paratha", qty: "2 pieces", kcal: 380 },
        { name: "Dahi", qty: "1 katori", kcal: 95 },
      ],
      total: 475,
      macros: [
        { label: "Protein", value: "15 g" },
        { label: "Carbs", value: "59 g" },
        { label: "Fat", value: "21 g" },
      ],
    },
  },
  {
    id: "wedding",
    prompt: "Today I had a wedding meal",
    lang: "English",
    reply:
      "Sounds like a lovely celebration — enjoy it, no guilt needed. Tell me what was on your plate and I’ll log it properly. Meanwhile, here’s a gentle 3-day rebalance you can take or leave:",
    attachment: {
      kind: "plan",
      title: "Rebalance plan · 3 days",
      days: [
        { day: "Day 1", text: "Lighter dinner + a 20-min walk", delta: "−250 kcal" },
        { day: "Day 2", text: "Dal, sabzi & salad thali", delta: "−250 kcal" },
        { day: "Day 3", text: "Extra water, early dinner", delta: "−150 kcal" },
      ],
    },
  },
  {
    id: "protein",
    prompt: "Mujhe high protein dinner chahiye",
    lang: "Hinglish",
    reply: "Bilkul! Aaj aapke ~540 kcal bache hain aur protein target se 32 g peeche hai. Aapki veg preference ke hisaab se teen options:",
    attachment: {
      kind: "options",
      title: "High-protein veg dinners",
      options: [
        { name: "Paneer bhurji + 2 roti", kcal: "~480 kcal", protein: "30 g protein" },
        { name: "Moong dal chilla + dahi", kcal: "~410 kcal", protein: "26 g protein" },
        { name: "Soya pulao + boondi raita", kcal: "~470 kcal", protein: "29 g protein" },
      ],
    },
    followUp: "Kisi ki bhi recipe chahiye toh bataiye.",
  },
];

const FOODS = [
  { emoji: "🫓", name: "Roti", cal: "70 cal" },
  { emoji: "🍛", name: "Dal Tadka", cal: "180 cal" },
  { emoji: "🍚", name: "Rice", cal: "130 cal" },
  { emoji: "🥘", name: "Paneer", cal: "320 cal" },
  { emoji: "🫔", name: "Samosa", cal: "150 cal" },
  { emoji: "🍲", name: "Biryani", cal: "450 cal" },
];

// Deterministic waveform profile (no Math.random, so SSR and client agree).
const WAVE = [0.35, 0.6, 0.45, 0.8, 0.5, 0.95, 0.4, 0.7, 0.55, 0.85, 0.3, 0.65, 0.5, 0.9, 0.45, 0.75, 0.35, 0.6, 0.8, 0.4, 0.7, 0.5, 0.9, 0.45, 0.65, 0.3, 0.55, 0.4];

type Stage = "listening" | "typing" | "done";

const bubbleIn = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 } };

export function VoiceDemo() {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = React.useState(DEMOS[0].id);
  const [stage, setStage] = React.useState<Stage>("done");
  const [viaVoice, setViaVoice] = React.useState(false);
  const timers = React.useRef<number[]>([]);

  const clearTimers = React.useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  React.useEffect(() => clearTimers, [clearTimers]);

  const play = (id: string, voice: boolean) => {
    clearTimers();
    setActiveId(id);
    setViaVoice(voice);
    if (reduce) {
      setStage("done");
      return;
    }
    if (voice) {
      setStage("listening");
      timers.current.push(window.setTimeout(() => setStage("typing"), 1200));
      timers.current.push(window.setTimeout(() => setStage("done"), 2000));
    } else {
      setStage("typing");
      timers.current.push(window.setTimeout(() => setStage("done"), 750));
    }
  };

  const playNext = () => {
    const idx = DEMOS.findIndex((d) => d.id === activeId);
    play(DEMOS[(idx + 1) % DEMOS.length].id, true);
  };

  const demo = DEMOS.find((d) => d.id === activeId) ?? DEMOS[0];
  const listening = stage === "listening";
  const motionProps = reduce ? { initial: false as const } : { ...bubbleIn, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <div className="relative">
      {/* Prompt chips */}
      <div role="group" aria-label="Example prompts" className="flex flex-wrap gap-2">
        {DEMOS.map((d) => {
          const selected = d.id === activeId;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={selected}
              onClick={() => play(d.id, false)}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-left text-sm leading-snug",
                "transition-[background-color,border-color,color,transform] duration-220 ease-orza",
                selected
                  ? "border-[#141414] bg-[#141414] text-orza-bg-0"
                  : "border-[rgba(20,20,20,0.10)] bg-white/60 text-orza-strong hover:-translate-y-px hover:bg-white/80"
              )}
            >
              <Sparkles size={12} strokeWidth={1.75} className={cn("shrink-0", selected ? "text-orza-cyan-400" : "text-orza-cyan-600")} aria-hidden />
              <span>&ldquo;{d.prompt}&rdquo;</span>
            </button>
          );
        })}
      </div>

      {/* Conversation */}
      <GlassCard variant="strong" padded={false} className="mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(20,20,20,0.08)] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[rgba(20,20,20,0.10)] bg-white/80">
              <span className="h-3 w-3 rounded-full bg-orza-dot" />
            </span>
            <div className="min-w-0">
              <div className="font-editorial text-[17px] font-semibold leading-5 text-orza-strong">ÖRZA</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">Voice &amp; chat</div>
            </div>
          </div>
          <Tag size="sm" dot={false}>
            Sample conversation
          </Tag>
        </div>

        <div aria-live="polite" className="flex min-h-[520px] flex-col gap-3 px-4 py-5 sm:min-h-[430px] sm:px-5">
          {/* User turn */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`u-${demo.id}-${listening ? "l" : "t"}`} {...motionProps} className="flex flex-col items-end gap-1.5">
              <div className="max-w-[88%] rounded-orza-md rounded-tr-sm border border-[rgba(20,20,20,0.08)] bg-[rgba(20,20,20,0.04)] px-4 py-3 text-[15px] leading-relaxed text-orza-strong">
                {listening ? (
                  <span aria-hidden className="flex h-6 items-center gap-[3px]">
                    {WAVE.slice(0, 16).map((v, i) => (
                      <motion.span
                        key={i}
                        aria-hidden
                        className="block h-full w-[3px] rounded-full bg-orza-strong/50"
                        initial={false}
                        animate={{ scaleY: [v * 0.3, v, v * 0.4] }}
                        transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse", delay: i * 0.04 }}
                      />
                    ))}
                  </span>
                ) : (
                  <>
                    {viaVoice && (
                      <>
                        <Mic size={14} strokeWidth={1.75} className="mr-1.5 inline-block -translate-y-px text-orza-muted" aria-hidden />
                        <span className="sr-only">Spoken: </span>
                      </>
                    )}
                    {demo.prompt}
                  </>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-orza-subtle">
                <Languages size={12} strokeWidth={1.75} aria-hidden />
                {listening ? "Listening…" : `Detected: ${demo.lang}`}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* ÖRZA turn */}
          <AnimatePresence mode="wait" initial={false}>
            {stage === "typing" && (
              <motion.div
                key="typing"
                {...motionProps}
                className="self-start rounded-orza-md rounded-tl-sm border border-[rgba(20,20,20,0.10)] bg-white/85 px-4 py-3.5 shadow-orza-glass"
              >
                <span className="sr-only">ÖRZA is typing</span>
                <span aria-hidden className="flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="block h-1.5 w-1.5 rounded-full bg-orza-subtle"
                      animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </span>
              </motion.div>
            )}
            {stage === "done" && (
              <motion.div
                key={`r-${demo.id}`}
                {...motionProps}
                className="w-full max-w-[94%] self-start rounded-orza-md rounded-tl-sm border border-[rgba(20,20,20,0.10)] bg-white/85 px-4 py-3 shadow-orza-glass"
              >
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-orza-cyan-600">ÖRZA</span>
                <p className="text-[15px] leading-relaxed text-orza-strong">{demo.reply}</p>
                <AttachmentView a={demo.attachment} />
                {demo.followUp && <p className="mt-3 text-sm text-orza-muted">{demo.followUp}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Voice bar */}
        <div className="flex items-center gap-3 border-t border-[rgba(20,20,20,0.08)] bg-white/40 px-4 py-3 sm:px-5">
          <div aria-hidden className="flex h-7 min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
            {WAVE.map((v, i) => (
              <motion.span
                key={i}
                className="block h-full w-[3px] shrink-0 rounded-full bg-gradient-to-t from-orza-amber via-orza-coral to-orza-pink"
                initial={false}
                animate={listening && !reduce ? { scaleY: [v * 0.35, v, v * 0.5, v * 0.9, v * 0.35], opacity: 1 } : { scaleY: v * 0.38, opacity: 0.45 }}
                transition={listening && !reduce ? { duration: 1.1, repeat: Infinity, delay: i * 0.035, ease: "easeInOut" } : { duration: 0.35 }}
              />
            ))}
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">
            {listening ? "Listening…" : "Play a voice example"}
          </span>
          <button
            type="button"
            onClick={playNext}
            aria-label="Play the next voice example"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orza-cyan text-[#062A31]",
              "transition-[background-color,box-shadow] duration-220 ease-orza hover:bg-orza-cyan-400",
              listening && "shadow-[0_0_0_6px_rgba(11,190,220,0.18)]"
            )}
          >
            <Mic size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </GlassCard>

      {/* Everyday food chips */}
      <div className="mt-6">
        <Eyebrow className="text-[11px]">Everyday Indian food · per serving</Eyebrow>
        <ul className="mt-3 flex flex-wrap gap-2">
          {FOODS.map((f) => (
            <li
              key={f.name}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[rgba(20,20,20,0.10)] bg-white/70 pl-2.5 pr-3.5 text-sm text-orza-strong backdrop-blur-orza transition-[background-color,transform] duration-220 ease-orza hover:-translate-y-px hover:bg-white"
            >
              <span aria-hidden className="text-base leading-none">
                {f.emoji}
              </span>
              {f.name}
              <span className="font-mono text-[12px] text-orza-muted">{f.cal}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/login?mode=signup"
        className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-orza-strong underline decoration-[rgba(11,190,220,0.55)] underline-offset-4 transition-colors duration-150 ease-orza hover:text-black"
      >
        Try it in the app
        <ArrowRight size={14} strokeWidth={1.75} className="transition-transform duration-220 ease-orza group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}

function AttachmentView({ a }: { a: Attachment }) {
  if (a.kind === "log") {
    return (
      <div className="mt-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-orza-success">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#EAF7F1]">
              <Check size={10} strokeWidth={2.5} aria-hidden />
            </span>
            Logged · {a.meal}
          </span>
          <span className="font-editorial text-lg font-semibold tabular-nums text-orza-strong">
            {a.total} <span className="font-sans text-xs font-normal text-orza-muted">kcal</span>
          </span>
        </div>
        <ul className="mt-1.5 divide-y divide-[rgba(20,20,20,0.06)]">
          {a.items.map((it) => (
            <li key={it.name} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-orza-strong">
                {it.name} <span className="text-orza-muted">· {it.qty}</span>
              </span>
              <span className="font-mono text-[12px] tabular-nums text-orza-muted">{it.kcal} kcal</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {a.macros.map((m) => (
            <div key={m.label} className="rounded-orza-xs bg-[rgba(20,20,20,0.035)] px-2.5 py-1.5">
              <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-orza-subtle">{m.label}</dt>
              <dd className="text-sm font-medium tabular-nums text-orza-strong">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (a.kind === "plan") {
    return (
      <div className="mt-3 rounded-orza-sm border border-[rgba(255,122,106,0.25)] bg-[rgba(255,241,234,0.7)] p-3">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#C2410C]">
          <HeartHandshake size={12} strokeWidth={1.75} aria-hidden />
          {a.title}
        </div>
        <ol className="mt-2 space-y-1.5">
          {a.days.map((d) => (
            <li key={d.day} className="flex items-center gap-3 rounded-orza-xs bg-white/75 px-3 py-2 text-sm">
              <span className="w-11 shrink-0 font-mono text-[11px] text-orza-subtle">{d.day}</span>
              <span className="min-w-0 flex-1 text-orza-strong">{d.text}</span>
              <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#C2410C]">{d.delta}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-orza-subtle">{a.title}</div>
      <ol className="mt-2 space-y-1.5">
        {a.options.map((o, i) => (
          <li key={o.name} className="flex items-center gap-3 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/70 px-3 py-2.5">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orza-cyan-50 font-mono text-[11px] text-orza-cyan-600">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-snug text-orza-strong">{o.name}</span>
              <span className="block text-[12px] text-orza-muted">{o.kcal}</span>
            </span>
            <Tag tone="info" size="sm" dot={false} className="shrink-0">
              {o.protein}
            </Tag>
          </li>
        ))}
      </ol>
    </div>
  );
}
