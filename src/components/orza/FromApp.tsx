"use client";
/**
 * Pages opened from the ÖRZA phone app (`?from=app`): the browser side of src/lib/from-app.ts.
 * `FromAppWatcher` (root layout) keeps the tab marked, cleans the address and stops links to the home page and Pricing;
 * `useFromApp` and `AppBackButton` give app-opened pages their Back button; `BrandHome` is the logo, a plain mark there.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FROM_APP_ATTR, FROM_APP_PARAM, FROM_APP_STORAGE_KEY, blockedFromApp, isFromAppSearch } from "@/lib/from-app";
import { cn } from "@/lib/utils";

const markedNow = () => document.documentElement.hasAttribute(FROM_APP_ATTR);

/**
 * Where the site sends someone who just signed out or deleted their account: the home page, or the sign-in page in a tab
 * opened from the app (the home page is marketing with a way to Pricing, `blockedFromApp`). Call it from an event handler.
 */
export const pathAfterLeaving = (): "/" | "/login" => (markedNow() ? "/login" : "/");

/**
 * Marks the tab when the address has `from=app` (like the <head> script, for addresses reached without a page load) and
 * returns the path of the page the app opened, or null when this tab didn't come from the app.
 */
function syncFromApp(): string | null {
  const here = window.location.pathname;
  const fromUrl = isFromAppSearch(window.location.search);
  try {
    const store = window.sessionStorage;
    if (fromUrl) store.setItem(FROM_APP_STORAGE_KEY, here);
    const start = store.getItem(FROM_APP_STORAGE_KEY);
    if (start !== null) document.documentElement.setAttribute(FROM_APP_ATTR, "");
    return start;
  } catch {
    // No sessionStorage: only this page (its address said from=app) is treated as opened from the app.
    if (fromUrl) document.documentElement.setAttribute(FROM_APP_ATTR, "");
    return markedNow() ? here : null;
  }
}

/** Takes `from=app` out of the address bar (the tab stays marked), so a link shared from the in-app browser opens the normal site. */
function dropParamFromAddress() {
  const url = new URL(window.location.href);
  if (!isFromAppSearch(url.search)) return;
  url.searchParams.delete(FROM_APP_PARAM);
  try {
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* the address keeps from=app; nothing else depends on it */
  }
}

/** Root layout: keeps an app-opened tab marked through in-site navigation and blocks links to the home page and Pricing. */
export function FromAppWatcher() {
  const pathname = usePathname();

  React.useEffect(() => {
    if (syncFromApp() !== null) dropParamFromAddress();
  }, [pathname]);

  React.useEffect(() => {
    // Capture phase on window: runs before React's and Next's link handlers, so a blocked link does nothing at all.
    const onClick = (e: MouseEvent) => {
      if (!markedNow()) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      let url: URL;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || !blockedFromApp(url.pathname)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  return null;
}

const NOT_FROM_APP = { fromApp: false, canGoBack: false };

/** Whether this tab came from the app, and whether it moved on from the page the app opened (so Back stays on the site). */
export function useFromApp(): { fromApp: boolean; canGoBack: boolean } {
  const pathname = usePathname();
  const [state, setState] = React.useState(NOT_FROM_APP);
  React.useEffect(() => {
    const start = syncFromApp();
    setState(start === null ? NOT_FROM_APP : { fromApp: true, canGoBack: start !== window.location.pathname });
  }, [pathname]);
  return state;
}

/** "Back" for app-opened tabs that moved on to another page of the site; nothing otherwise (the in-app browser's own close button returns to the app). */
export function AppBackButton({ className, dark }: { className?: string; dark?: boolean }) {
  const { canGoBack } = useFromApp();
  if (!canGoBack) return null;
  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors duration-150 ease-orza",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/40",
        dark
          ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
          : "border-[rgba(20,20,20,0.12)] bg-white/70 text-orza-strong hover:bg-white/90",
        className
      )}
    >
      <ArrowLeft size={15} strokeWidth={1.75} aria-hidden />
      Back
    </button>
  );
}

/**
 * The logo: a link to `href` normally, a plain mark (no link) in a tab opened from the app. Both are rendered and CSS
 * picks one before the first paint (`display` is the mark's display then, e.g. "app:flex").
 */
export function BrandHome({
  href,
  label,
  className,
  display,
  children,
}: {
  href: string;
  label: string;
  className?: string;
  display: "app:flex" | "app:inline-flex";
  children: React.ReactNode;
}) {
  return (
    <>
      <Link href={href} aria-label={label} className={cn(className, "app:hidden")}>
        {children}
      </Link>
      <span className={cn(className, "hidden", display)}>{children}</span>
    </>
  );
}
