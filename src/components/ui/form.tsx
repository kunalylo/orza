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
  "bg-[url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%235B5B5B%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E\")]";

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

/** Segmented control (pill tabs). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn("inline-flex rounded-full border border-[rgba(20,20,20,0.10)] bg-white/60 p-1 backdrop-blur-orza", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full font-medium transition-colors duration-150 ease-orza",
            size === "sm" ? "px-3 h-7 text-xs" : "px-4 h-8 text-sm",
            value === o.value ? "bg-[#141414] text-orza-bg-0" : "text-orza-muted hover:text-orza-strong"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("orza-skeleton", className)} aria-hidden />;
}
