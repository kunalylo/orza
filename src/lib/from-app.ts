/**
 * Website pages opened from the ÖRZA phone app. The app adds `?from=app` to every website address it opens (privacy,
 * terms, trust, support and account pages). For the rest of that browser tab's visit the site then hides its menus, its
 * marketing links and every way to Pricing (App Store 3.1.1: no route to prices from the app), keeping the page's own
 * content (the legal pages and their links between each other) and a Back button. Normal visits never change.
 *
 * How it works:
 * - An inline script in <head> (`FROM_APP_SCRIPT`, root layout) runs before the first paint: `from=app` in the address
 *   stores the page's path in sessionStorage (`FROM_APP_STORAGE_KEY`), and while that is set it puts `data-from-app` on
 *   <html>. sessionStorage belongs to one browser tab (the in-app browser's), so the member's other tabs and later visits
 *   are untouched; a cookie would not do on Android, where Chrome Custom Tabs share Chrome's cookies.
 * - The Tailwind variant `app:` (tailwind.config.ts) styles against that attribute: `app:hidden` hides, `hidden app:flex`
 *   shows only for the app. No flash: the attribute is there before the page paints.
 * - `FromAppWatcher` (src/components/orza/FromApp.tsx) re-applies it after in-site navigation, takes `from=app` out of
 *   the address (a shared link opens the normal site) and stops links to `blockedFromApp` paths.
 * - The middleware keeps `from=app` through the sign-in redirect, and `FROM_APP_HEADER` lets server redirects keep it.
 *
 * Pure (no imports): safe in the browser, the middleware and server components.
 */
export const FROM_APP_PARAM = "from";
export const FROM_APP_VALUE = "app";
/** sessionStorage key; its value is the path of the page the app opened (the Back button shows on any other page). */
export const FROM_APP_STORAGE_KEY = "orza.fromApp";
/** Attribute on <html> while the tab came from the app (the `app:` Tailwind variant). */
export const FROM_APP_ATTR = "data-from-app";
/** Request header the middleware adds to a `from=app` request, so a server redirect can keep `from=app`. */
export const FROM_APP_HEADER = "x-orza-from-app";

/** Whether a query string (with or without "?") or params carry `from=app`. */
export function isFromAppSearch(search: string | URLSearchParams): boolean {
  return new URLSearchParams(search).get(FROM_APP_PARAM) === FROM_APP_VALUE;
}

/** Paths a tab opened from the app never goes to: the home page (marketing, with Pricing) and Pricing. */
export function blockedFromApp(pathname: string): boolean {
  return pathname === "/" || pathname === "/pricing" || pathname.startsWith("/pricing/");
}

/** `path` (a path with an optional query and hash) with `from=app` added when `fromApp`, for server redirects. */
export function keepFromApp(path: string, fromApp: boolean): string {
  if (!fromApp) return path;
  const hashAt = path.indexOf("#");
  const base = hashAt < 0 ? path : path.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : path.slice(hashAt);
  if (isFromAppSearch(base.includes("?") ? base.slice(base.indexOf("?")) : "")) return path;
  return `${base}${base.includes("?") ? "&" : "?"}${FROM_APP_PARAM}=${FROM_APP_VALUE}${hash}`;
}

/**
 * Inline <head> script (before the first paint). Without sessionStorage (blocked storage) only a page whose own address
 * has `from=app` gets the attribute.
 */
export const FROM_APP_SCRIPT = `(function(){var d=document.documentElement,q=false,k=${JSON.stringify(FROM_APP_STORAGE_KEY)};try{q=new URLSearchParams(location.search).get(${JSON.stringify(
  FROM_APP_PARAM
)})===${JSON.stringify(FROM_APP_VALUE)}}catch(e){}try{var s=window.sessionStorage;if(q)s.setItem(k,location.pathname);if(s.getItem(k)!==null)d.setAttribute(${JSON.stringify(
  FROM_APP_ATTR
)},"")}catch(e){if(q)d.setAttribute(${JSON.stringify(FROM_APP_ATTR)},"")}})();`;
