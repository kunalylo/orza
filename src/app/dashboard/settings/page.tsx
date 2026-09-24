"use client";
import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useUser } from "@/components/app/UserProvider";
import { PageHeader } from "@/components/app/ui";
import { GlassCard, Tag } from "@/components/orza/primitives";
import { Reveal } from "@/components/orza/Reveal";
import { formatDate } from "@/components/account/ui";
import { MemorySection } from "@/components/account/settings/MemorySection";
import { PreferencesSection } from "@/components/account/settings/PreferencesSection";
import { PrivacySection } from "@/components/account/settings/PrivacySection";
import { ProfileSection } from "@/components/account/settings/ProfileSection";
import { SettingsNav } from "@/components/account/settings/SettingsNav";
import { TargetsSection } from "@/components/account/settings/TargetsSection";
import { formatNumber } from "@/lib/utils";

function AccountSummary() {
  const { user } = useUser();
  const initial = (user.name || user.email).trim().slice(0, 1).toUpperCase();
  return (
    <GlassCard variant="strong" padded={false} className="relative overflow-hidden p-5 sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 h-[260px] w-[260px] rounded-full"
        style={{ background: "radial-gradient(circle at 40% 40%, rgba(255,180,84,0.22) 0%, rgba(255,95,162,0.08) 45%, rgba(0,0,0,0) 70%)", filter: "blur(8px)" }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orza-energy font-editorial text-[22px] font-semibold text-white shadow-[0_10px_30px_rgba(255,122,106,0.35)]">
            {initial}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-editorial text-[22px] font-semibold leading-7 text-orza-strong">{user.name || "You"}</span>
              {user.is_admin && (
                <Tag tone="violet" size="sm">
                  Admin
                </Tag>
              )}
            </div>
            <div className="truncate text-[14px] text-orza-muted">{user.email}</div>
            {user.created_at && <div className="mt-0.5 text-[12px] text-orza-subtle">Member since {formatDate(user.created_at)}</div>}
          </div>
        </div>
        <Link
          href="/dashboard/credits"
          className="inline-flex items-center gap-2 self-start rounded-full border border-[rgba(255,122,106,0.28)] bg-[#FFF1EA] px-4 py-2 text-[13px] font-medium text-[#C2410C] transition-colors duration-150 ease-orza hover:bg-[#FFE8DC] sm:self-auto"
        >
          <Sparkles size={14} strokeWidth={2} aria-hidden /> {formatNumber(user.credits)} AI credits
        </Link>
      </div>
    </GlassCard>
  );
}

/** Settings — profile, daily targets, preferences, ÖRZA's memory, privacy & data. */
export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Your settings" description="Tune ÖRZA to your body, your food and your pace. Everything here is private to you." />

      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <SettingsNav />
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <Reveal y={10}>
            <AccountSummary />
          </Reveal>
          <ProfileSection />
          <TargetsSection />
          <PreferencesSection />
          <MemorySection />
          <PrivacySection />
        </div>
      </div>
    </div>
  );
}
