import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Camera, MessageCircle, Mic } from "lucide-react";
import { IconTile } from "@/components/orza/primitives";

/** The three ways to log/ask. `date` (when not today) is passed along so logging lands on the day being viewed. */
export function QuickActions({ date }: { date?: string }) {
  const q = date ? `?date=${date}` : "";
  const actions = [
    { href: `/dashboard/scan${q}`, label: "Snap a meal", hint: "AI estimates calories & macros", icon: Camera, tone: "energy" as const },
    { href: `/dashboard/meals${q}`, label: "Type or speak", hint: "English, Hindi or Hinglish", icon: Mic, tone: "cyan" as const },
    { href: "/dashboard/chat", label: "Ask ÖRZA", hint: "Your wellness companion", icon: MessageCircle, tone: "violet" as const },
  ];
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-1">
      {actions.map(({ href, label, hint, icon: Icon, tone }) => (
        <Link
          key={label}
          href={href}
          className="group flex flex-col items-start gap-3 rounded-orza-md border border-[rgba(20,20,20,0.10)] bg-white/60 p-3.5 backdrop-blur-orza transition-[background-color,box-shadow,transform] duration-220 ease-orza hover:-translate-y-[1px] hover:bg-white/85 hover:shadow-orza-glass lg:flex-row lg:items-center lg:gap-3.5"
        >
          <IconTile tone={tone} className="h-9 w-9 sm:h-10 sm:w-10">
            <Icon size={17} strokeWidth={1.75} aria-hidden />
          </IconTile>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium leading-tight text-orza-strong sm:text-[14px]">{label}</span>
            <span className="mt-0.5 hidden text-[12.5px] leading-snug text-orza-muted sm:block">{hint}</span>
          </span>
          <ArrowUpRight
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="hidden shrink-0 text-orza-subtle transition-colors duration-150 group-hover:text-orza-strong lg:block"
          />
        </Link>
      ))}
    </nav>
  );
}
