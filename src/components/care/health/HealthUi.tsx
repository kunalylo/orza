"use client";
import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copies text to the clipboard, with a textarea fallback for older browsers / non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Small pill copy button with a transient check mark. */
export function CopyButton({ text, label, className, tone = "light" }: { text: string; label: string; className?: string; tone?: "light" | "dark" }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={async () => {
        if (await copyText(text)) setCopied(true);
        else toast.error("Couldn't copy automatically — select the text and copy it instead.");
      }}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-orza",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/50",
        tone === "dark" ? "bg-white/10 text-white/85 hover:bg-white/20" : "border border-[rgba(20,20,20,0.12)] bg-white/80 text-orza-strong hover:bg-white",
        className
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** A labelled one-line value (URL, header) with a copy button; wraps instead of overflowing at 375px. */
export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-orza-subtle">{label}</span>
        <CopyButton text={value} label={label.toLowerCase()} />
      </div>
      <div className={cn("mt-1.5 break-all text-[13px] leading-5 text-orza-strong", mono && "font-mono")}>{value}</div>
    </div>
  );
}

/** Dark code block with a copy button (JSON bodies, curl). */
export function CodeBlock({ code, label, className }: { code: string; label: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-orza-sm border border-white/10 bg-[#0E1116]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">{label}</span>
        <CopyButton text={code} label={label.toLowerCase()} tone="dark" />
      </div>
      <pre className="max-h-[320px] overflow-auto p-3 text-[12px] leading-5 text-[#E6EDF3]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Numbered steps. */
export function Steps({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ol className={cn("space-y-3", className)}>{children}</ol>;
}

export function Step({ n, title, children }: { n: number; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(20,20,20,0.12)] bg-white/80 font-mono text-[11px] text-orza-strong"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-6 text-orza-strong">{title}</div>
        {children && <div className="mt-1 space-y-2 text-[13.5px] leading-relaxed text-orza-muted">{children}</div>}
      </div>
    </li>
  );
}

/** Inline UI-label styling for names of buttons/menus in instructions. */
export function Ui({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-orza-strong">{children}</span>;
}
