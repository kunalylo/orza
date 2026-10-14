"use client";
import * as React from "react";
import { Brain, KeyRound, ShieldCheck, SlidersHorizontal, Target, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "targets", label: "Daily targets", icon: Target },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "security", label: "Password", icon: KeyRound },
  { id: "privacy", label: "Privacy & data", icon: ShieldCheck },
];

/** Tracks which section is in view (the last one whose top has passed ~30% of the viewport). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0]);
  React.useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.3;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // At the very bottom, the last section wins even if it is short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = ids[ids.length - 1];
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);
  return active;
}

const IDS = SETTINGS_SECTIONS.map((s) => s.id);

/** In-page navigation: a sticky rail on desktop, a sticky scrollable chip row on phones. */
export function SettingsNav() {
  const active = useActiveSection(IDS);

  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <>
      {/* Phones / tablets: chips under the app bar */}
      <nav
        aria-label="Settings sections"
        className="sticky top-14 z-20 -mx-4 mb-5 border-b border-[rgba(20,20,20,0.06)] bg-[rgba(251,247,241,0.88)] px-4 py-2.5 backdrop-blur-orza sm:-mx-6 sm:px-6 lg:hidden"
      >
        <ul className="no-scrollbar flex gap-2 overflow-x-auto">
          {SETTINGS_SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                onClick={(e) => go(e, s.id)}
                aria-current={active === s.id ? "location" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors duration-150 ease-orza",
                  active === s.id
                    ? "border-transparent bg-[#141414] text-orza-bg-0"
                    : "border-[rgba(20,20,20,0.10)] bg-white/70 text-orza-muted hover:text-orza-strong"
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Desktop: sticky rail */}
      <nav aria-label="Settings sections" className="sticky top-10 hidden self-start lg:block">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-orza-subtle">On this page</div>
        <ul className="mt-3 flex flex-col gap-0.5 border-l border-[rgba(20,20,20,0.08)]">
          {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
            const on = active === id;
            return (
              <li key={id}>
                <a
                  href={`#${id}`}
                  onClick={(e) => go(e, id)}
                  aria-current={on ? "location" : undefined}
                  className={cn(
                    "-ml-px flex items-center gap-2.5 border-l-2 py-2 pl-4 text-[14px] transition-colors duration-150 ease-orza",
                    on ? "border-[#FF7A6A] font-medium text-orza-strong" : "border-transparent text-orza-muted hover:text-orza-strong"
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} className={on ? "text-[#E0593F]" : "opacity-70"} aria-hidden />
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
