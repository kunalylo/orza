/** Server side of src/lib/from-app.ts: redirects that keep `from=app` (server components only). */
import { headers } from "next/headers";
import { FROM_APP_HEADER, keepFromApp } from "@/lib/from-app";

/**
 * A redirect target for this request: `path` with `from=app` added when the request came from a page the phone app opened
 * (the middleware's `FROM_APP_HEADER`), so the page it lands on still hides the site's menus. Unchanged otherwise.
 */
export async function keepFromAppRedirect(path: string): Promise<string> {
  return keepFromApp(path, (await headers()).get(FROM_APP_HEADER) === "1");
}
