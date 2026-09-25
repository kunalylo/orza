import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-orza-sm border border-[rgba(20,20,20,0.12)] bg-white/80 px-3.5 text-[15px] text-orza-strong " +
  "placeholder:text-orza-subtle transition-[border-color,box-shadow,background-color] duration-150 ease-orza " +
  "focus:outline-none focus:border-orza-cyan focus:bg-white focus:shadow-[0_0_0_3px_rgba(11,190,220,0.18)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...rest} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "min-h-[96px] py-3 leading-relaxed resize-y", className)} {...rest} />;
  }
);

const chevron =
  "bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235B5B5B%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(fieldBase, "h-11 appearance-none pr-9 bg-no-repeat bg-[right_12px_center]", chevron, className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[13px] font-medium text-orza-strong mb-1.5", className)} {...rest} />;
}

export function FieldHint({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-xs text-orza-subtle", className)} {...rest} />;
}

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
  /** Tabs mode: id of the panel this tab shows (defaults to the control's `panelId`). */
  controls?: string;
};

const NEXT_KEYS: Record<string, 1 | -1 | "first" | "last"> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
  Home: "first",
  End: "last",
};

/**
 * Segmented control (pill buttons) for picking one of a few options.
 *
 * - Default: a single-choice form field — `role="radiogroup"` with `role="radio"` / `aria-checked`.
 *   Name it with `aria-label` or `aria-labelledby` (a visible label's id).
 * - `semantics="tabs"`: a view switcher that shows one panel — `role="tablist"` / `role="tab"`.
 *   Give each tab an id base via `id` and point at the panel with `panelId`; the panel should be
 *   `<div role="tabpanel" id={panelId} aria-labelledby={`${id}-${value}`}>`.
 *
 * Keyboard (both modes): one Tab stop (the selected option); ←/→ (and ↑/↓) move and select;
 * Home / End jump to the first / last option.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  semantics = "radio",
  id,
  panelId,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  "aria-describedby": ariaDescribedby,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  size?: "sm" | "md";
  semantics?: "radio" | "tabs";
  /** Id of the group; tabs get `${id}-${value}` ids. */
  id?: string;
  /** Tabs mode: id of the tabpanel the tabs control. */
  panelId?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const tabs = semantics === "tabs";
  const enabled = options.filter((o) => !o.disabled && !disabled);
  const selectedEnabled = enabled.some((o) => o.value === value);
  // Roving tab stop: the selected option, or the first enabled one when nothing valid is selected.
  const tabStop = selectedEnabled ? value : enabled[0]?.value;

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const step = NEXT_KEYS[e.key];
    if (step === undefined || !enabled.length) return;
    e.preventDefault();
    const current = enabled.findIndex((o) => o.value === (e.currentTarget.dataset.value as T));
    let next: number;
    if (step === "first") next = 0;
    else if (step === "last") next = enabled.length - 1;
    else next = ((current < 0 ? 0 : current + step) + enabled.length) % enabled.length;
    const target = enabled[next];
    if (target.value !== value) onChange(target.value);
    const group = e.currentTarget.parentElement;
    const button = Array.from(group?.querySelectorAll<HTMLButtonElement>("button[data-value]") ?? []).find(
      (b) => b.dataset.value === target.value
    );
    button?.focus();
  }

  return (
    <div
      id={id}
      role={tabs ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-disabled={disabled || undefined}
      className={cn("inline-flex rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 p-1 backdrop-blur-orza", className)}
    >
      {options.map((o) => {
        const selected = value === o.value;
        const isDisabled = disabled || !!o.disabled;
        return (
          <button
            key={o.value}
            type="button"
            role={tabs ? "tab" : "radio"}
            id={tabs && id ? `${id}-${o.value}` : undefined}
            aria-selected={tabs ? selected : undefined}
            aria-checked={tabs ? undefined : selected}
            aria-controls={tabs ? o.controls ?? panelId : undefined}
            data-value={o.value}
            tabIndex={o.value === tabStop && !isDisabled ? 0 : -1}
            disabled={isDisabled}
            onClick={() => onChange(o.value)}
            onKeyDown={onKeyDown}
            className={cn(
              "rounded-full font-medium transition-colors duration-150 ease-orza disabled:cursor-not-allowed disabled:opacity-50",
              size === "sm" ? "px-3 h-7 text-xs" : "px-4 h-8 text-sm",
              selected ? "bg-[#141414] text-orza-bg-0" : "text-orza-muted hover:text-orza-strong"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("orza-skeleton", className)} aria-hidden />;
}
