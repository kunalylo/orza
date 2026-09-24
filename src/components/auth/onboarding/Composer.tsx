"use client";
import * as React from "react";
import { ArrowRight, ArrowUp, Check, Plus, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Segmented } from "@/components/ui/form";
import type { StepOption, StepPrompt } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import type { Answer } from "./types";

type OnAnswer = (answer: Answer, display: string) => void;
type PickerProps = { prompt: StepPrompt; busy: boolean; onAnswer: OnAnswer };

/**
 * The answer area under the conversation. Renders whatever the current step asks for:
 * quick-reply chips, a searchable list, multi-select chips, a number with units, or free text.
 */
export function Composer({ prompt, busy, onAnswer }: PickerProps) {
  if (prompt.summary) return <SummaryActions prompt={prompt} busy={busy} onAnswer={onAnswer} />;
  switch (prompt.input) {
    case "choice":
      return prompt.featured ? <SearchPicker prompt={prompt} busy={busy} onAnswer={onAnswer} /> : <ChoicePicker prompt={prompt} busy={busy} onAnswer={onAnswer} />;
    case "multi":
      return <MultiPicker prompt={prompt} busy={busy} onAnswer={onAnswer} />;
    case "number":
      return <NumberAnswer prompt={prompt} busy={busy} onAnswer={onAnswer} />;
    case "text":
      return <TextAnswer prompt={prompt} busy={busy} onAnswer={onAnswer} />;
    default:
      return null;
  }
}

/* ───────────────────────────── Shared bits ───────────────────────────── */

/** Focus a field when a new question appears — desktop only, so phones don't pop the keyboard unasked. */
function useDesktopAutoFocus(ref: React.RefObject<HTMLInputElement | null>, enabled = true) {
  React.useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia?.("(pointer: fine)").matches) return;
    const t = window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(t);
  }, [ref, enabled]);
}

const chipBase =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-[14px] font-medium leading-tight " +
  "transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-orza active:scale-[0.98] " +
  "disabled:pointer-events-none disabled:opacity-50";
const chipOff =
  "border-[rgba(20,20,20,0.12)] bg-white/80 text-orza-strong hover:border-[rgba(20,20,20,0.24)] hover:bg-white hover:shadow-orza-glass";
const chipOn = "border-[#141414] bg-[#141414] text-orza-bg-0 shadow-orza-cta";

function Chip({ selected, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button type="button" className={cn(chipBase, selected ? chipOn : chipOff, className)} {...rest}>
      {children}
    </button>
  );
}

function SendButton({ disabled, label = "Send answer" }: { disabled?: boolean; label?: string }) {
  return (
    <button
      type="submit"
      aria-label={label}
      disabled={disabled}
      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#141414] text-orza-bg-0 shadow-orza-cta transition-[background-color,opacity,box-shadow] duration-150 ease-orza hover:bg-black disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none"
    >
      <ArrowUp size={18} strokeWidth={2} aria-hidden />
    </button>
  );
}

// 16px text keeps iOS from zooming into the field on focus.
const fieldClass = "h-12 rounded-full pl-5 pr-5 text-[16px]";

/** One-line free-text answer with a send button. */
function InlineText({
  placeholder,
  busy,
  label,
  maxLength = 200,
  onSubmit,
  autoFocus,
}: {
  placeholder?: string;
  busy: boolean;
  label: string;
  maxLength?: number;
  onSubmit: (text: string) => void;
  autoFocus?: boolean;
}) {
  const id = React.useId();
  const ref = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState("");
  useDesktopAutoFocus(ref, !!autoFocus);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = value.trim();
        if (!t || busy) return;
        onSubmit(t);
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Input
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          enterKeyHint="send"
          className={fieldClass}
        />
      </div>
      <SendButton disabled={busy || !value.trim()} />
    </form>
  );
}

/* ───────────────────────────── Single choice ───────────────────────────── */

function ChoicePicker({ prompt, busy, onAnswer }: PickerProps) {
  const options = prompt.options ?? [];
  const detailed = options.some((o) => o.hint);
  return (
    <div className="space-y-3">
      {detailed ? (
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Choose one">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={busy}
              onClick={() => onAnswer(o.value, o.label)}
              className="group flex items-center justify-between gap-3 rounded-orza-md border border-[rgba(20,20,20,0.12)] bg-white/80 px-4 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-orza hover:border-[rgba(20,20,20,0.24)] hover:bg-white hover:shadow-orza-glass active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-orza-strong">{o.label}</span>
                {o.hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-orza-muted">{o.hint}</span>}
              </span>
              <ArrowRight
                size={16}
                strokeWidth={1.75}
                aria-hidden
                className="shrink-0 text-orza-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose one">
          {options.map((o) => (
            <Chip key={o.value} disabled={busy} onClick={() => onAnswer(o.value, o.label)}>
              {o.label}
            </Chip>
          ))}
        </div>
      )}
      {prompt.allow_custom && (
        <InlineText label="Or type your own answer" placeholder={prompt.placeholder} busy={busy} onSubmit={(t) => onAnswer(t, t)} />
      )}
    </div>
  );
}

/* ───────────────────────────── Searchable choice (region) ───────────────────────────── */

function SearchPicker({ prompt, busy, onAnswer }: PickerProps) {
  const id = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  useDesktopAutoFocus(inputRef);

  const options = prompt.options ?? [];
  const featured = (prompt.featured ?? []).map((v) => options.find((o) => o.value === v) ?? { value: v, label: v });
  const q = query.trim().toLowerCase();
  const matches = q
    ? options
        .filter((o) => o.label.toLowerCase().includes(q))
        .sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)))
        .slice(0, 12)
    : [];
  const list: StepOption[] = q ? matches : showAll ? options : featured;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !q) return;
    if (matches.length === 1) onAnswer(matches[0].value, matches[0].label);
    else onAnswer(query.trim(), query.trim()); // cities & nicknames are resolved server-side
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex items-center gap-2" role="search">
        <div className="relative flex-1">
          <label htmlFor={id} className="sr-only">
            Search your state or city
          </label>
          <Search size={16} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-orza-subtle" />
          <Input
            ref={inputRef}
            id={id}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={prompt.placeholder || "Search your state or city"}
            maxLength={80}
            autoComplete="off"
            enterKeyHint="search"
            aria-controls={`${id}-list`}
            className={cn(fieldClass, "pl-11")}
          />
        </div>
        <SendButton disabled={busy || !q} />
      </form>

      <div
        id={`${id}-list`}
        role="group"
        aria-label={q ? "Matching places" : showAll ? "All states and territories" : "Popular choices"}
        className={cn("flex flex-wrap gap-2", showAll && !q && "max-h-56 overflow-y-auto p-0.5")}
      >
        {list.map((o) => (
          <Chip key={o.value} disabled={busy} onClick={() => onAnswer(o.value, o.label)}>
            {o.label}
          </Chip>
        ))}
      </div>

      {q && matches.length === 0 && (
        <p className="text-[13px] leading-relaxed text-orza-muted">
          No state matches “{query.trim()}”. Send it anyway — I know most cities too.
        </p>
      )}
      {!q && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="text-[13px] font-medium text-orza-muted underline decoration-[rgba(20,20,20,0.25)] underline-offset-4 hover:text-orza-strong"
        >
          {showAll ? "Show fewer" : `Show all ${options.length} options`}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────── Multi select (allergies) ───────────────────────────── */

function MultiPicker({ prompt, busy, onAnswer }: PickerProps) {
  const options = prompt.options ?? [];
  const exclusive = React.useMemo(() => new Set(prompt.exclusive ?? []), [prompt.exclusive]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [custom, setCustom] = React.useState<string[]>([]);

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  function toggle(v: string) {
    setSelected((s) => {
      if (s.includes(v)) return s.filter((x) => x !== v);
      if (exclusive.has(v)) return [v];
      return [...s.filter((x) => !exclusive.has(x)), v];
    });
  }

  function addCustom(text: string) {
    const t = text.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!t) return;
    const known = options.find((o) => o.value.toLowerCase() === t.toLowerCase() || o.label.toLowerCase() === t.toLowerCase());
    if (known) {
      if (!selected.includes(known.value)) toggle(known.value);
      return;
    }
    if (custom.some((c) => c.toLowerCase() === t.toLowerCase()) || custom.length >= 8) return;
    setCustom((c) => [...c, t]);
    setSelected((s) => [...s.filter((x) => !exclusive.has(x)), t]);
  }

  function removeCustom(v: string) {
    setCustom((c) => c.filter((x) => x !== v));
    setSelected((s) => s.filter((x) => x !== v));
  }

  const count = selected.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose all that apply">
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Chip key={o.value} selected={on} aria-pressed={on} disabled={busy} onClick={() => toggle(o.value)}>
              {on && <Check size={14} strokeWidth={2.25} aria-hidden />}
              {o.label}
            </Chip>
          );
        })}
        {custom.map((c) => (
          <span key={c} className={cn(chipBase, chipOn, "pr-1.5")}>
            <Check size={14} strokeWidth={2.25} aria-hidden />
            {c}
            <button
              type="button"
              onClick={() => removeCustom(c)}
              disabled={busy}
              aria-label={`Remove ${c}`}
              className="ml-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-orza-bg-0/80 transition-colors hover:bg-white/15 hover:text-orza-bg-0"
            >
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
          </span>
        ))}
      </div>

      {prompt.allow_custom && <AddCustom placeholder={prompt.placeholder} busy={busy} onAdd={addCustom} />}

      <Button
        size="lg"
        className="h-12 w-full sm:w-auto sm:min-w-[200px]"
        disabled={count === 0}
        loading={busy}
        onClick={() => onAnswer(selected, selected.map(labelOf).join(", "))}
      >
        {count === 0 ? "Pick at least one" : selected.some((s) => exclusive.has(s)) ? "Continue" : `Continue (${count})`}
        {count > 0 && !busy && <ArrowRight size={16} strokeWidth={1.75} aria-hidden />}
      </Button>
    </div>
  );
}

function AddCustom({ placeholder, busy, onAdd }: { placeholder?: string; busy: boolean; onAdd: (t: string) => void }) {
  const id = React.useId();
  const [value, setValue] = React.useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value);
        setValue("");
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor={id} className="sr-only">
        Add another food to avoid
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "Add your own"}
        maxLength={40}
        autoComplete="off"
        enterKeyHint="done"
        disabled={busy}
        className={cn(fieldClass, "h-11")}
      />
      <Button type="submit" variant="secondary" className="h-11 shrink-0 px-4" disabled={busy || !value.trim()}>
        <Plus size={15} strokeWidth={2} aria-hidden />
        Add
      </Button>
    </form>
  );
}

/* ───────────────────────────── Numbers with units ───────────────────────────── */

const UNIT_LABEL: Record<string, string> = { cm: "cm", ft: "ft / in", kg: "kg", lb: "lb" };
const NUMERIC = /^\d+(?:[.,]\d+)?$/;

const NumberField = React.forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; suffix?: string; label: string; placeholder?: string; maxLength?: number }
>(function NumberField({ value, onChange, suffix, label, placeholder, maxLength = 10 }, ref) {
  const id = React.useId();
  return (
    <div className="relative min-w-0 flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Input
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="send"
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(fieldClass, "tabular-nums", suffix && "pr-16")}
      />
      {suffix && (
        <span aria-hidden className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-mono text-[12px] uppercase tracking-[0.1em] text-orza-subtle">
          {suffix}
        </span>
      )}
    </div>
  );
});

function NumberAnswer({ prompt, busy, onAnswer }: PickerProps) {
  const units = prompt.units;
  const [unit, setUnit] = React.useState(units?.[0] ?? "");
  const [value, setValue] = React.useState("");
  const [feet, setFeet] = React.useState("");
  const [inches, setInches] = React.useState("");
  const ref = React.useRef<HTMLInputElement>(null);
  useDesktopAutoFocus(ref);

  const imperialHeight = unit === "ft";
  const suffix = unit || prompt.unit_hint;
  // Example numbers in the server's placeholder are metric; convert for pounds.
  const example = Number(prompt.placeholder?.match(/\d+(?:\.\d+)?/)?.[0]);
  const placeholder = Number.isFinite(example) ? `e.g. ${unit === "lb" ? Math.round(example * 2.2046) : example}` : undefined;
  const canSend = imperialHeight ? NUMERIC.test(feet.trim()) && (!inches.trim() || NUMERIC.test(inches.trim())) : !!value.trim();

  function changeUnit(u: string) {
    setUnit(u);
    setValue("");
    setFeet("");
    setInches("");
    window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 0);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !canSend) return;
    if (imperialHeight) {
      const f = Math.floor(Number(feet.replace(",", ".")));
      const i = inches.trim() ? Number(inches.replace(",", ".")) : 0;
      onAnswer(`${f}'${i}"`, `${f} ft ${i} in`);
      return;
    }
    const raw = value.trim().replace(",", ".");
    if (!NUMERIC.test(raw)) {
      onAnswer(raw, raw); // free text like "5'8" or "70kg" — the server parses it
      return;
    }
    if (units?.length) onAnswer(`${raw} ${unit}`, `${raw} ${unit}`);
    else onAnswer(Number(raw), raw);
  }

  const skip = prompt.optional ? prompt.options ?? [] : [];

  return (
    <form onSubmit={submit} className="space-y-3">
      {units && units.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">Units</span>
          <Segmented size="sm" value={unit} onChange={changeUnit} options={units.map((u) => ({ value: u, label: UNIT_LABEL[u] ?? u }))} />
        </div>
      )}
      <div className="flex items-center gap-2">
        {imperialHeight ? (
          <>
            <NumberField ref={ref} value={feet} onChange={setFeet} suffix="ft" label="Height — feet" placeholder="5" maxLength={1} />
            <NumberField value={inches} onChange={setInches} suffix="in" label="Height — inches" placeholder="6" maxLength={4} />
          </>
        ) : (
          <NumberField
            ref={ref}
            value={value}
            onChange={setValue}
            suffix={suffix}
            label={suffix ? `Your answer in ${suffix}` : "Your answer"}
            placeholder={placeholder}
            maxLength={12}
          />
        )}
        <SendButton disabled={busy || !canSend} />
      </div>
      {skip.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {skip.map((o) => (
            <Chip key={o.value} disabled={busy} onClick={() => onAnswer(o.value, o.label)}>
              {o.label}
            </Chip>
          ))}
        </div>
      )}
    </form>
  );
}

/* ───────────────────────────── Free text (lifestyle) ───────────────────────────── */

function TextAnswer({ prompt, busy, onAnswer }: PickerProps) {
  const id = React.useId();
  const ref = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState("");
  const [picked, setPicked] = React.useState<string[]>([]);
  useDesktopAutoFocus(ref);

  const answer = [...picked, text.trim()].filter(Boolean).join(", ");
  const suggestions = prompt.options ?? [];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !answer) return;
    onAnswer(answer, answer);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Suggestions">
          {suggestions.map((o) => {
            const on = picked.includes(o.value);
            return (
              <Chip
                key={o.value}
                selected={on}
                aria-pressed={on}
                disabled={busy}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== o.value) : [...p, o.value]))}
              >
                {on ? <Check size={14} strokeWidth={2.25} aria-hidden /> : <Plus size={14} strokeWidth={2} aria-hidden />}
                {o.label}
              </Chip>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <label htmlFor={id} className="sr-only">
            Tell ÖRZA about your routine
          </label>
          <Input
            ref={ref}
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={picked.length ? "Anything else? (optional)" : prompt.placeholder}
            maxLength={240}
            autoComplete="off"
            enterKeyHint="send"
            className={fieldClass}
          />
        </div>
        <SendButton disabled={busy || !answer || answer.length > 300} />
      </div>
      {prompt.optional && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAnswer("skip", "Skip for now")}
          className="text-[13px] font-medium text-orza-muted underline decoration-[rgba(20,20,20,0.25)] underline-offset-4 hover:text-orza-strong disabled:opacity-50"
        >
          Skip for now
        </button>
      )}
    </form>
  );
}

/* ───────────────────────────── Summary ───────────────────────────── */

function SummaryActions({ prompt, busy, onAnswer }: PickerProps) {
  const confirm = prompt.options?.find((o) => o.value === "confirm")?.label ?? "Looks good — let's go";
  const restart = prompt.options?.find((o) => o.value === "restart")?.label ?? "Start over";
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      <Button variant="secondary" size="lg" className="h-12" disabled={busy} onClick={() => onAnswer("restart", restart)}>
        <RotateCcw size={15} strokeWidth={1.75} aria-hidden />
        {restart}
      </Button>
      <Button variant="energy" size="lg" className="h-12 px-7" loading={busy} onClick={() => onAnswer("confirm", confirm)}>
        {confirm}
        {!busy && <ArrowRight size={16} strokeWidth={1.75} aria-hidden />}
      </Button>
    </div>
  );
}
