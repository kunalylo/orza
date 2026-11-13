import { NextResponse, type NextRequest } from "next/server";
import { FROM_APP_HEADER, isFromAppSearch, keepFromApp } from "@/lib/from-app";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

/**
 * Signed-out visitors can't reach the app; they're sent to /login?next=… A page the phone app opened (`from=app`,
 * src/lib/from-app.ts) keeps `from=app` on that sign-in page, and its request gets `FROM_APP_HEADER` so the layouts'
 * own redirects keep it too.
 */
export async function middleware(req: NextRequest) {
  const fromApp = isFromAppSearch(req.nextUrl.searchParams);
  const userId = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = keepFromApp(`?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, fromApp);
    return NextResponse.redirect(url);
  }
  if (!fromApp) return NextResponse.next();
  const headers = new Headers(req.headers);
  headers.set(FROM_APP_HEADER, "1");
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/dashboard/:path*", "/onboarding/:path*", "/onboarding"] };
