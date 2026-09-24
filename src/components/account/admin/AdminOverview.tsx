"use client";
import * as React from "react";
import { CalendarDays, Camera, ClipboardList, Coins, Cpu, Database, MessageCircle, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { StatCard } from "@/components/app/ui";
import { Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { Skeleton } from "@/components/ui/form";
import type { AdminStats } from "@/components/account/types";
import { cn, formatNumber } from "@/lib/utils";

/** Today's date in India time, e.g. "Wed, 24 Sept" — matches how `meals_today` is counted. */
function istToday() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** Status row on the dark hero: icon, label, value pill and a one-line explanation. */
function StatusRow({
  icon: Icon,
  label,
  value,
  ok,
  note,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  ok: boolean;
  note: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-orza-sm border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-orza">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/80">
        <Icon size={16} strokeWidth={1.75} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">{label}</span>
          {/* Tag tones re-tinted for the dark surface */}
          <Tag
            tone={ok ? "success" : "warning"}
            className={
              ok
                ? "border-[rgba(95,211,164,0.35)] bg-[rgba(95,211,164,0.12)] text-[#8FE6C2]"
                : "border-[rgba(255,180,84,0.35)] bg-[rgba(255,180,84,0.12)] text-[#FFD08A]"
            }
          >
            {value}
          </Tag>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-white/60">{note}</p>
      </div>
    </div>
  );
}

/** Dark hero with the member count as an editorial numeral, plus AI / database status. */
function OverviewHero({ stats }: { stats: AdminStats }) {
  const mongo = stats.database === "mongodb";
  return (
    <section
      aria-labelledby="admin-overview-title"
      className="relative isolate overflow-hidden rounded-orza-xl bg-orza-hero p-6 text-[var(--orza-hero-text)] shadow-orza-floating sm:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 10% 0%, rgba(47,210,240,0.12) 0%, rgba(7,9,12,0) 50%)," +
            "radial-gradient(ellipse at 0% 100%, rgba(191,168,255,0.10) 0%, rgba(7,9,12,0) 55%)," +
            "radial-gradient(ellipse at 45% 40%, rgba(255,180,84,0.10) 0%, rgba(7,9,12,0) 50%)",
        }}
      />
      <div aria-hidden className="orza-hero-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay" />
      {/* Glowing energy orb */}
      <div aria-hidden className="pointer-events-none absolute -left-10 -bottom-24 h-[220px] w-[220px] opacity-60 sm:left-[30%] sm:-bottom-20 sm:opacity-80">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,180,84,0.38) 0%, rgba(255,122,106,0.18) 40%, rgba(255,95,162,0.05) 62%, rgba(7,9,12,0) 72%)",
            filter: "blur(18px)",
          }}
        />
        <div
          className="absolute inset-[30%] animate-orza-pulse rounded-full"
          style={{
            background: "radial-gradient(circle at 36% 32%, #FFF6EA 0%, #FFE7C8 14%, #FFB454 40%, #FF7A6A 68%, #FF5FA2 100%)",
            boxShadow: "0 0 60px rgba(255,122,106,0.5), 0 0 120px rgba(255,95,162,0.22)",
          }}
        />
      </div>

      <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 backdrop-blur-orza">
            <CalendarDays size={12} strokeWidth={1.75} className="text-orza-amber" aria-hidden />
            Platform · {istToday()} IST
          </span>
          <h2 id="admin-overview-title" className="sr-only">
            Platform overview
          </h2>
          <div className="mt-7">
            <div className="orza-energy-text font-editorial text-[64px] font-semibold leading-[0.95] tracking-[-0.04em] tabular-nums sm:text-[84px]">
              {formatNumber(stats.users)}
            </div>
            <div className="mt-2 text-[15px] text-white/75">{stats.users === 1 ? "member" : "members"} on ÖRZA</div>
          </div>
          <p className="mt-4 text-[14px] text-white/60">
            <span className="font-medium text-white/90">+{formatNumber(stats.new_users_7d)}</span> joined in the last 7 days
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <StatusRow
            icon={Cpu}
            label="AI engine"
            value={stats.ai_enabled ? "AI on" : "Built-in engine"}
            ok={stats.ai_enabled}
            note={
              stats.ai_enabled
                ? "OpenAI is configured. AI actions spend credits and refund them on failure."
                : "No OPENAI_API_KEY — logging, chat, recipes and plans use the free built-in engine. Photo scans are off."
            }
          />
          <StatusRow
            icon={Database}
            label="Database"
            value={mongo ? "MongoDB" : "Local file"}
            ok={mongo}
            note={mongo ? "Connected through MONGODB_URI." : "Data lives in .data/orza-db.json — fine for development, set MONGODB_URI for production."}
          />
        </div>
      </div>
    </section>
  );
}

const TILES: { key: keyof AdminStats; label: string; icon: LucideIcon; hint: (s: AdminStats) => string }[] = [
  { key: "meals_today", label: "Meals today", icon: UtensilsCrossed, hint: () => "Logged by anyone, India time" },
  { key: "meals_total", label: "Meals logged", icon: ClipboardList, hint: (s) => (s.users ? `≈ ${formatNumber(s.meals_total / s.users)} per member` : "All time") },
  { key: "scans_total", label: "Photo scans", icon: Camera, hint: () => "Snap & Know, all time" },
  { key: "chat_messages_total", label: "Chat messages", icon: MessageCircle, hint: () => "From members and ÖRZA" },
  { key: "credits_spent_total", label: "Credits used", icon: Coins, hint: () => "Sum of all deductions" },
];

/** Admin overview: hero + five stat tiles. */
export function AdminOverview({ stats }: { stats: AdminStats }) {
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <Reveal y={10}>
        <OverviewHero stats={stats} />
      </Reveal>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {TILES.map((t, i) => {
          const Icon = t.icon;
          return (
            <Reveal key={t.key} delay={0.04 * i} className={cn("h-full", i === TILES.length - 1 && "col-span-2 md:col-span-1")}>
              <StatCard
                className="h-full"
                label={t.label}
                value={<span className="tabular-nums">{formatNumber(Number(stats[t.key]) || 0)}</span>}
                icon={<Icon size={16} strokeWidth={1.75} aria-hidden />}
                hint={t.hint(stats)}
              />
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4 lg:gap-5" aria-busy="true" aria-label="Loading platform stats">
      <Skeleton className="h-[300px] rounded-orza-xl sm:h-[260px]" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={cn("h-[118px] rounded-orza-md", i === 4 && "col-span-2 md:col-span-1")} />
        ))}
      </div>
    </div>
  );
}
