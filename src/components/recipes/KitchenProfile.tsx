import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Flame, Leaf, MapPin, ShieldCheck } from "lucide-react";
import { Eyebrow } from "@/components/orza/primitives";
import { cn, formatNumber } from "@/lib/utils";
import type { PublicUser } from "@/lib/types";
import { DIET_LABELS } from "./types";

/** Dark orb panel on the ÖRZA hero surface — the orb glows behind the content. */
export function OrbSurface({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-orza-lg border border-white/10 bg-orza-hero text-[var(--orza-hero-text)] shadow-orza-floating",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 -z-10 h-[300px] w-[300px] animate-orza-pulse rounded-full sm:h-[340px] sm:w-[340px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,231,200,0.9) 0%, rgba(255,180,84,0.7) 16%, rgba(255,122,106,0.34) 38%, rgba(255,95,162,0.12) 58%, rgba(7,9,12,0) 70%)",
          filter: "blur(10px)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 orza-hero-grain opacity-[0.05]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2"
        style={{ background: "linear-gradient(180deg, rgba(7,9,12,0) 0%, rgba(11,15,20,0.6) 100%)" }}
      />
      {children}
    </div>
  );
}

/** "Cooking for you" — what every recipe is tuned to (diet, allergies, region, calorie budget). */
export function KitchenProfile({ user }: { user: PublicUser }) {
  const p = user.profile || {};
  const allergies = (p.allergies || []).filter((a) => a && a.toLowerCase() !== "none");
  const perMeal = Math.round(((user.targets?.calories || 2000) * 0.3) / 10) * 10;
  const rows = [
    { icon: Leaf, label: "Diet", value: p.diet ? DIET_LABELS[p.diet] : "No restriction set" },
    { icon: ShieldCheck, label: "Always avoiding", value: allergies.length ? allergies.join(", ") : "No allergies on file" },
    { icon: MapPin, label: "Home kitchen", value: p.region || "Across India" },
    {
      icon: Flame,
      label: "Calorie budget",
      value: `${formatNumber(user.targets?.calories || 2000)} kcal a day · about ${formatNumber(perMeal)} per main meal`,
    },
  ];
  return (
    <OrbSurface className="flex h-full flex-col p-5 sm:p-7">
      <Eyebrow tone="dark">Cooking for you</Eyebrow>
      <p className="mt-3 max-w-[18ch] font-editorial text-[24px] font-semibold leading-[1.2] tracking-[-0.01em] text-white sm:text-[26px]">
        Every recipe is tuned to your plate.
      </p>
      <dl className="mt-6 space-y-4">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex gap-3.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[#FFB454]" aria-hidden>
              <Icon size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/55">{label}</dt>
              <dd className="mt-0.5 break-words text-[14.5px] leading-snug text-white/90">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="mt-auto pt-6">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1.5 text-[13px] text-white/80 transition-colors duration-220 ease-orza hover:border-white/40 hover:text-white"
        >
          Update preferences <ArrowUpRight size={14} strokeWidth={1.9} aria-hidden />
        </Link>
      </div>
    </OrbSurface>
  );
}
