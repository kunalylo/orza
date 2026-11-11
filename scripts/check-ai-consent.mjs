#!/usr/bin/env node
/**
 * Checks the AI consent server contract against a running ÖRZA server (local by default): `user.ai_consent` in `{user}`
 * answers (null when none), `PUT` / `DELETE /api/settings/ai-consent`, and R1 — the six AI routes refuse requests from
 * every client (the phone app's Bearer token and the website's cookie) with 403 `ai_consent_required` until the account
 * allows the AI features, and one record serves both: a consent or a Turn off on one is seen by the other. See
 * src/lib/ai-consent.ts.
 *
 *   npx next dev -p 3101                                      (another terminal; no .env.local: JSON-file database, AI off)
 *   ORZA_BASE_URL=http://localhost:3101 node scripts/check-ai-consent.mjs
 *
 * It makes no AI calls, whatever the server's key: every AI-route request either expects the 403 or sends a body the
 * route's validation refuses (400), so none reaches the AI. R2 (the coach's prompt without tracked steps) needs an AI
 * call to observe, so it isn't checked here.
 * Each run signs up a new throwaway account (`ai-consent-check-…@orza.test`, as the phone app does), which is left in the
 * database. It refuses any host other than localhost / 127.0.0.1 / [::1] / *.localhost / *.test unless
 * ORZA_CHECK_ALLOW_REMOTE=1 (never point it at production). Exit code 1 when a check fails.
 */
import { randomBytes } from "node:crypto";

const BASE = (process.env.ORZA_BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const host = new URL(BASE).hostname.replace(/^\[|\]$/g, "").toLowerCase();
const local = ["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".localhost") || host.endsWith(".test");
if (!local && process.env.ORZA_CHECK_ALLOW_REMOTE !== "1") {
  console.error(`Refusing to run against ${BASE}: it signs up a test account. Set ORZA_CHECK_ALLOW_REMOTE=1 for a test server.`);
  process.exit(2);
}

const APP = { "X-ORZA-Client": "mobile", "X-ORZA-Device": "ai-consent-check", "X-ORZA-Platform": "android" };

/**
 * One request. `as`: "app" (Bearer + the app headers), "bearer" (the app's Bearer token without the app headers),
 * "web" (the website's session cookie, same-origin), or "none" (signed out).
 */
async function call(method, path, body, as = "app") {
  const headers = { "content-type": "application/json" };
  if (as === "app") Object.assign(headers, APP);
  if ((as === "app" || as === "bearer") && token) headers.authorization = `Bearer ${token}`;
  if (as === "web") Object.assign(headers, { origin: BASE, ...(cookie ? { cookie } : {}) });
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, res };
}

let token = "";
let cookie = "";
let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);
const brief = (r) => ({ status: r.status, code: r.json.code, error: r.json.error });

/** The six AI routes, each with a body its validation refuses (so no request can reach the AI). */
const AI_ROUTES = [
  ["/chat/send", { message: "" }],
  ["/meals/text", { text: "a" }],
  ["/meals/scan", { image: "x" }],
  ["/recipes/generate", { max_calories: 5 }],
  ["/compensation/plan", { occasion: "x" }],
  ["/prescriptions/scan", { image: "x" }],
];
const refused = (r) => r.status === 403 && r.json.code === "ai_consent_required";
/** Past the consent check: refused by validation, or (photo scan with the AI off) by `ai_disabled`. */
const pastConsent = (path, r) =>
  (r.status === 400 && r.json.code === "validation") || (path === "/meals/scan" && r.status === 503 && r.json.code === "ai_disabled");

async function eachRoute(name, as, expect) {
  for (const [path, body] of AI_ROUTES) {
    const r = await call("POST", path, body, as);
    check(`${name}: POST ${path}`, expect(path, r), brief(r));
  }
}

async function main() {
  console.log(`Server: ${BASE}`);
  const email = `ai-consent-check-${Date.now()}-${randomBytes(3).toString("hex")}@orza.test`;
  const password = randomBytes(18).toString("base64url");
  const reg = await call("POST", "/auth/register", { name: "AI consent check", email, password });
  if (reg.status !== 201 || !reg.json.token) {
    console.error(`Sign-up failed (${reg.status}): ${JSON.stringify(reg.json).slice(0, 200)}`);
    process.exit(2);
  }
  token = reg.json.token;
  console.log(`Account: ${email}`);

  /* ── 1: the field ── */
  check("register: user.ai_consent is null (present)", "ai_consent" in reg.json.user && reg.json.user.ai_consent === null, reg.json.user?.ai_consent);
  let me = await call("GET", "/auth/me");
  if (!me.json.user || !("ai_consent" in me.json.user)) {
    console.error("GET /api/auth/me has no user.ai_consent — this server has no AI consent (an older build).");
    process.exit(1);
  }
  check("GET /api/auth/me: user.ai_consent is null", me.json.user.ai_consent === null, me.json.user.ai_consent);

  /* ── 2, 3: R1 without consent ── */
  let r = await call("POST", "/chat/send", { message: "" }, "none");
  check("signed out: 401 before the consent check", r.status === 401, brief(r));
  await eachRoute("app, no consent → 403 ai_consent_required", "app", (_, r) => refused(r));
  await eachRoute("app Bearer without X-ORZA-Client, no consent → 403 (session kind)", "bearer", (_, r) => refused(r));
  r = await call("POST", "/chat/send", { message: "" }, "app");
  check("403 error text", r.json.error === "Allow ÖRZA's AI features in the app to use this.", r.json.error);

  /* ── 4: PUT ── */
  for (const [label, body] of [
    ["{}", {}],
    ["{version: 0}", { version: 0 }],
    ["{version: 1.5}", { version: 1.5 }],
    ["{version: \"1\"}", { version: "1" }],
    ["{version: 1001}", { version: 1001 }],
  ]) {
    r = await call("PUT", "/settings/ai-consent", body);
    check(`PUT ${label} → 400 validation`, r.status === 400 && r.json.code === "validation", brief(r));
  }
  skip("PUT with a version below the server's → 409 ai_consent_outdated", "needs a server with AI_CONSENT_VERSION > 1 (the emulator plan's AC-8)");
  r = await call("PUT", "/settings/ai-consent", { version: 1 });
  const at = r.json.user?.ai_consent?.at;
  check(
    "PUT {version: 1} → 200 {user} with ai_consent {version: 1, at}",
    r.status === 200 && r.json.user.ai_consent?.version === 1 && typeof at === "string" && !Number.isNaN(Date.parse(at)) && !("password_hash" in r.json.user),
    { status: r.status, ai_consent: r.json.user?.ai_consent }
  );
  me = await call("GET", "/auth/me");
  check("GET /api/auth/me shows the consent", me.json.user?.ai_consent?.version === 1 && me.json.user.ai_consent.at === at, me.json.user?.ai_consent);
  r = await call("PUT", "/settings/ai-consent", { version: 1 });
  check("PUT again → 200, at refreshed", r.status === 200 && r.json.user.ai_consent?.version === 1 && r.json.user.ai_consent.at >= at, r.json.user?.ai_consent);
  check("PUT leaves preferences.ai_training_opt_out alone", r.json.user?.preferences?.ai_training_opt_out === reg.json.user.preferences?.ai_training_opt_out, r.json.user?.preferences);

  /* ── 5: R1 with consent ── */
  await eachRoute("app, consent → past the check (400 validation; 503 ai_disabled for a photo scan with AI off)", "app", pastConsent);
  await eachRoute("app Bearer without X-ORZA-Client, consent → past the check", "bearer", pastConsent);

  /* ── 6: DELETE ── */
  r = await call("DELETE", "/settings/ai-consent");
  check("DELETE → 200 {user} with ai_consent null", r.status === 200 && r.json.user && r.json.user.ai_consent === null, brief(r));
  me = await call("GET", "/auth/me");
  check("GET /api/auth/me: ai_consent null again", me.json.user?.ai_consent === null, me.json.user?.ai_consent);
  await eachRoute("app after DELETE → 403 again", "app", (_, r) => refused(r));
  r = await call("DELETE", "/settings/ai-consent");
  check("DELETE again → 200 (idempotent)", r.status === 200 && r.json.user?.ai_consent === null, brief(r));

  /* ── 7: the website (cookie) asks too, on the same record ── */
  const login = await call("POST", "/auth/login", { email, password }, "web");
  const set = login.res.headers.getSetCookie?.() ?? [];
  const session = set.map((c) => c.split(";")[0]).find((c) => c.startsWith("orza_session=") && c.length > "orza_session=".length);
  if (login.status !== 200 || !session) {
    check("website sign-in sets the session cookie", false, { status: login.status, cookies: set.length });
  } else {
    cookie = session;
    me = await call("GET", "/auth/me", undefined, "web");
    check("website: GET /api/auth/me has ai_consent null", me.status === 200 && me.json.user?.ai_consent === null, me.json.user?.ai_consent);
    await eachRoute("website cookie, no consent → 403 ai_consent_required", "web", (_, r) => refused(r));
    r = await call("POST", "/chat/send", { message: "" }, "web");
    check("website 403 error text (for a tab on an old page)", r.json.error === "Please reload the page to allow ÖRZA's AI features.", r.json.error);
    r = await call("POST", "/chat/send", { message: "" });
    check("app 403 error text unchanged", r.json.error === "Allow ÖRZA's AI features in the app to use this.", r.json.error);

    // The consent itself is a state change behind the cookie: the cross-site guard applies.
    const foreign = await fetch(`${BASE}/api/settings/ai-consent`, {
      method: "PUT",
      headers: { "content-type": "application/json", origin: "https://not-orza.example", cookie },
      body: JSON.stringify({ version: 1 }),
    });
    const foreignJson = await foreign.json().catch(() => ({}));
    check("website: a cross-site PUT is refused (403 cross_site)", foreign.status === 403 && foreignJson.code === "cross_site", { status: foreign.status, code: foreignJson.code });
    me = await call("GET", "/auth/me", undefined, "web");
    check("…and recorded nothing", me.json.user?.ai_consent === null, me.json.user?.ai_consent);

    r = await call("PUT", "/settings/ai-consent", { version: 1 }, "web");
    check("website: PUT with the cookie → 200 with the consent", r.status === 200 && r.json.user?.ai_consent?.version === 1, brief(r));
    await eachRoute("website cookie, consent → past the check", "web", pastConsent);
    r = await call("POST", "/chat/send", { message: "" });
    check("app sees the consent the website gave (400, not 403)", pastConsent("/chat/send", r), brief(r));
    r = await call("DELETE", "/settings/ai-consent", undefined, "web");
    check("website: DELETE with the cookie → 200, null", r.status === 200 && r.json.user?.ai_consent === null, brief(r));
    await eachRoute("website after its DELETE → 403 again", "web", (_, r) => refused(r));
    r = await call("POST", "/chat/send", { message: "" });
    check("app after the website's DELETE → 403", refused(r), brief(r));

    // A consent given on the phone is used on the website without asking (the gate's /auth/me read sees it).
    r = await call("PUT", "/settings/ai-consent", { version: 1 });
    check("app: PUT → 200", r.status === 200 && r.json.user?.ai_consent?.version === 1, brief(r));
    me = await call("GET", "/auth/me", undefined, "web");
    check("website: GET /api/auth/me shows the app's consent", me.json.user?.ai_consent?.version === 1, me.json.user?.ai_consent);
    await eachRoute("website cookie, the app's consent → past the check", "web", pastConsent);
    r = await call("DELETE", "/settings/ai-consent");
    check("app: DELETE → 200", r.status === 200 && r.json.user?.ai_consent === null, brief(r));
    r = await call("POST", "/chat/send", { message: "" }, "web");
    check("website after the app's Turn off → 403", refused(r), brief(r));
  }

  skip("R2: no tracked steps in the coach's prompt without consent", "needs an AI call to observe (review contextForPrompt / aiHistory in src/lib/coach.ts)");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
