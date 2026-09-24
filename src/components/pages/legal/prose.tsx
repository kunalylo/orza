import * as React from "react";
import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Small typographic building blocks for the policy pages (no typography plugin in this stack). */

export function LegalP({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[15px] leading-[1.75] text-orza-muted sm:text-base", className)}>{children}</p>;
}

export function LegalH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 font-editorial text-[19px] font-semibold leading-snug tracking-[-0.01em] text-orza-strong">{children}</h3>
  );
}

export function LegalList({ children, ordered = false }: { children: React.ReactNode; ordered?: boolean }) {
  const Comp = ordered ? "ol" : "ul";
  return <Comp className="flex flex-col gap-2.5">{children}</Comp>;
}

/** List item with a cyan dot; `title` renders as a bold lead-in ("Account details: …"). */
export function LegalLi({ title, children }: { title?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="relative pl-5 text-[15px] leading-[1.7] text-orza-muted sm:text-base">
      <span aria-hidden className="absolute left-0.5 top-[0.72em] h-1.5 w-1.5 rounded-full bg-orza-cyan" />
      {title && <strong className="font-semibold text-orza-strong">{title} </strong>}
      {children}
    </li>
  );
}

export function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-orza-strong">{children}</strong>;
}

const linkClass =
  "font-medium text-orza-cyan-600 underline decoration-[rgba(11,143,166,0.35)] underline-offset-4 transition-colors duration-150 hover:decoration-orza-cyan-600";

export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  );
}

/** mailto link to the support inbox (SITE.supportEmail). */
export function SupportEmail({ subject }: { subject?: string }) {
  const href = `mailto:${SITE.supportEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
  return (
    <a href={href} className={cn(linkClass, "break-all")}>
      {SITE.supportEmail}
    </a>
  );
}

/** Highlighted note inside a policy section. */
export function LegalCallout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning";
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  const warn = tone === "warning";
  const Icon = warn ? TriangleAlert : Info;
  return (
    <div
      role="note"
      className={cn(
        "flex gap-3.5 rounded-orza-md border p-4 sm:p-5",
        warn ? "border-[rgba(176,106,0,0.22)] bg-[#FFF4E6]/80" : "border-[rgba(11,190,220,0.22)] bg-[#E8FBFF]/70"
      )}
    >
      <Icon size={18} strokeWidth={1.75} className={cn("mt-0.5 shrink-0", warn ? "text-orza-warning" : "text-orza-cyan-600")} aria-hidden />
      <div className="min-w-0 space-y-2 text-[15px] leading-[1.7] text-orza-strong/85">
        {title && <p className="font-semibold text-orza-strong">{title}</p>}
        {children}
      </div>
    </div>
  );
}
