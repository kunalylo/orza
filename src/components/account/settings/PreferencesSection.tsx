"use client";
import * as React from "react";
import Link from "next/link";
import { Check, Globe2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/components/app/UserProvider";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { DEFAULT_PREFERENCES } from "@/components/account/options";
import { SectionCard, Switch } from "@/components/account/ui";
import type { ProfileResponse, UserResponse } from "@/components/account/types";
import { api, errorMessage } from "@/lib/api-client";
import { DEFAULT_TZ } from "@/lib/dates";
import type { Preferences } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_COPY: Record<Preferences["tone"], string> = {
  gentle: "Warm encouragement and no pressure — ÖRZA celebrates small wins.",
  direct: "Straight talk and clear next steps, still kind and judgment-free.",
};

function Row({
  id,
  title,
  description,
  control,
  className,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6", className)}>
      <div className="min-w-0">
        <div id={`${id}-label`} className="text-[14px] font-medium text-orza-strong">
          {title}
        </div>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-[13px] leading-snug text-orza-muted">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Preferences — each control saves on change (optimistic, reverted if the save fails). */
export function PreferencesSection() {
  const { user, setUser } = useUser();
  const server = React.useMemo<Preferences>(() => ({ ...DEFAULT_PREFERENCES, ...(user.preferences || {}) }), [user.preferences]);
  const [prefs, setPrefs] = React.useState<Preferences>(server);
  const [pending, setPending] = React.useState<Partial<Record<keyof Preferences, boolean>>>({});
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [deviceTz, setDeviceTz] = React.useState<string | null>(null);
  const [tzSaving, setTzSaving] = React.useState(false);

  React.useEffect(() => setPrefs(server), [server]);
  React.useEffect(() => setDeviceTz(deviceTimeZone()), []);
  React.useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2200);
    return () => clearTimeout(t);
  }, [savedAt]);

  async function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    if (prefs[key] === value || pending[key]) return; // one save per control at a time (keeps focus, avoids races)
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setPending((p) => ({ ...p, [key]: true }));
    try {
      const res = await api.put<UserResponse>("/settings/preferences", { [key]: value });
      setUser(res.user);
      setSavedAt(Date.now());
    } catch (err) {
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast.error(errorMessage(err));
    } finally {
      setPending((p) => ({ ...p, [key]: false }));
    }
  }

  const tz = user.profile?.timezone || DEFAULT_TZ;
  async function applyDeviceTz() {
    if (!deviceTz) return;
    setTzSaving(true);
    try {
      const res = await api.put<ProfileResponse>("/profile", { profile: { timezone: deviceTz } });
      setUser(res.user);
      toast.success("Time zone updated", { description: `Your days now follow ${deviceTz.replace(/_/g, " ")}.` });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTzSaving(false);
    }
  }

  return (
    <SectionCard
      id="preferences"
      icon={<SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden />}
      tone="violet"
      eyebrow="Preferences"
      title="How ÖRZA works for you"
      description="Changes save automatically."
      actions={
        <span aria-live="polite" className={cn("inline-flex items-center gap-1.5 text-[12px] text-[#127A56] transition-opacity duration-220", savedAt ? "opacity-100" : "opacity-0")}>
          {savedAt ? (
            <>
              <Check size={14} strokeWidth={2} aria-hidden /> Saved
            </>
          ) : null}
        </span>
      }
    >
      <div className="divide-y divide-[rgba(20,20,20,0.07)] border-y border-[rgba(20,20,20,0.07)]">
        <Row
          id="pref-units"
          title="Units"
          description="How weight and height are shown across ÖRZA."
          control={
            <div>
              <Segmented<Preferences["units"]> aria-labelledby="pref-units-label"
                value={prefs.units}
                onChange={(v) => update("units", v)}
                options={[
                  { value: "metric", label: "Metric · kg, cm" },
                  { value: "imperial", label: "Imperial · lb, ft" },
                ]}
                size="sm"
                className={cn(pending.units && "opacity-70")}
              />
            </div>
          }
        />
        <Row
          id="pref-tone"
          title="Coach tone"
          description={TONE_COPY[prefs.tone]}
          control={
            <div>
              <Segmented<Preferences["tone"]> aria-labelledby="pref-tone-label"
                value={prefs.tone}
                onChange={(v) => update("tone", v)}
                options={[
                  { value: "gentle", label: "Gentle" },
                  { value: "direct", label: "Direct" },
                ]}
                size="sm"
                className={cn(pending.tone && "opacity-70")}
              />
            </div>
          }
        />
        <Row
          id="pref-reminders"
          title="Gentle reminders"
          description="Friendly nudges to log meals and drink water."
          control={
            <Switch
              checked={prefs.reminders}
              onCheckedChange={(v) => update("reminders", v)}
              aria-labelledby="pref-reminders-label"
              aria-describedby="pref-reminders-desc"
            />
          }
        />
        <Row
          id="pref-weekly"
          title="Weekly report"
          description="A calm summary of your week — patterns, wins and one thing to try next."
          control={
            <Switch
              checked={prefs.weekly_report}
              onCheckedChange={(v) => update("weekly_report", v)}
              aria-labelledby="pref-weekly-label"
              aria-describedby="pref-weekly-desc"
            />
          }
        />
        <Row
          id="pref-ai"
          title="Help improve ÖRZA’s AI"
          description={
            <>
              Lets your conversations and logs, anonymized first, help make ÖRZA’s AI better. Turning this off doesn’t change how AI
              features work for you.{" "}
              <Link
                href="/privacy#ai-processing"
                className="rounded-sm text-orza-strong underline decoration-[rgba(20,20,20,0.25)] underline-offset-2 hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/40"
              >
                How we use data
              </Link>
            </>
          }
          control={
            <Switch
              checked={!prefs.ai_training_opt_out}
              onCheckedChange={(v) => update("ai_training_opt_out", !v)}
              aria-labelledby="pref-ai-label"
              aria-describedby="pref-ai-desc"
            />
          }
        />
        <Row
          id="pref-tz"
          title={
            <span className="inline-flex items-center gap-1.5">
              <Globe2 size={14} strokeWidth={1.75} className="text-orza-subtle" aria-hidden /> Time zone
            </span>
          }
          description={
            deviceTz && deviceTz !== tz
              ? `Your days follow ${tz.replace(/_/g, " ")}. This device is set to ${deviceTz.replace(/_/g, " ")}.`
              : `Your days follow ${tz.replace(/_/g, " ")}.`
          }
          control={
            deviceTz && deviceTz !== tz ? (
              <Button variant="secondary" size="sm" onClick={applyDeviceTz} loading={tzSaving}>
                Use this device&rsquo;s time zone
              </Button>
            ) : (
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">{tz.split("/").pop()?.replace(/_/g, " ")}</span>
            )
          }
        />
      </div>
    </SectionCard>
  );
}
