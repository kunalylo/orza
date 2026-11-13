#!/usr/bin/env node
/**
 * Checks the D3 store-readiness changes against a running ÖRZA server (local by default):
 * - minimum age 18: the onboarding age step, PUT /api/profile and POST /api/goals/calculate;
 * - "Help improve ÖRZA's AI" opt-in: new accounts off (`preferences.ai_training_opt_out: true`), only the member's own PUT
 *   turns it on (and stores `ai_training_chosen_at`), other preference saves and finishing onboarding keep it;
 * - the privacy policy's new lines (service providers, location, who is responsible + grievance contact, opt-in, date)
 *   and the trust page's AI training card;
 * - pages opened from the phone app (`?from=app`): the inline <head> script (run here in a sandbox with fake browser
 *   objects), the `app:` CSS, the middleware's sign-in redirect and the layouts' redirects keeping `from=app`;
 * - the pure helpers in src/lib/from-app.ts and src/lib/ai-improvement.ts (imported as TypeScript).
 *
 *   NODE_OPTIONS="--require E:/aylo/orza-mobile/scripts/e2e/noai-preload.cjs" npx next dev -p 3101   (another terminal; JSON-file database)
 *   ORZA_BASE_URL=http://localhost:3101 node --experimental-strip-types --no-warnings scripts/check-d3-web.mjs
 *
 * No AI calls (no AI route is called). Each run signs up two throwaway accounts (`d3-check-…@orza.test`: one as the phone
 * app, one as the website), left in the database. It refuses any host other than localhost / 127.0.0.1 / [::1] /
 * *.localhost / *.test unless ORZA_CHECK_ALLOW_REMOTE=1 (never point it at production). Exit code 1 when a check fails.
 */
import { randomBytes } from "node:crypto";
import vm from "node:vm";

const BASE = (process.env.ORZA_BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const host = new URL(BASE).hostname.replace(/^\[|\]$/g, "").toLowerCase();
const local = ["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".localhost") || host.endsWith(".test");
if (!local && process.env.ORZA_CHECK_ALLOW_REMOTE !== "1") {
  console.error(`Refusing to run against ${BASE}: it signs up test accounts. Set ORZA_CHECK_ALLOW_REMOTE=1 for a test server.`);
  process.exit(2);
}

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}

/* ───────────────────────────── Pure helpers ───────────────────────────── */

let fromApp, aiImprovement;
try {
  fromApp = await import(new URL("../src/lib/from-app.ts", import.meta.url));
  aiImprovement = await import(new URL("../src/lib/ai-improvement.ts", import.meta.url));
} catch (e) {
  console.error(`Run with \`node --experimental-strip-types\` (Node 22.6+) so the TypeScript helpers load: ${e.message}`);
  process.exit(2);
}
{
  const { keepFromApp, blockedFromApp, isFromAppSearch } = fromApp;
  check("keepFromApp adds ?from=app before the hash", keepFromApp("/privacy#ai-processing", true) === "/privacy?from=app#ai-processing", keepFromApp("/privacy#ai-processing", true));
  check("keepFromApp adds &from=app after a query", keepFromApp("/login?next=%2Fdashboard", true) === "/login?next=%2Fdashboard&from=app");
  check("keepFromApp: a from=app inside next= doesn't count", keepFromApp("?next=%2Fx%3Ffrom%3Dapp", true) === "?next=%2Fx%3Ffrom%3Dapp&from=app");
  check("keepFromApp leaves an address that has it", keepFromApp("/terms?from=app", true) === "/terms?from=app");
  check("keepFromApp changes nothing for normal visits", keepFromApp("/onboarding", false) === "/onboarding");
  check("isFromAppSearch", isFromAppSearch("?a=1&from=app") && isFromAppSearch("from=app") && !isFromAppSearch("?from=App") && !isFromAppSearch("?from=web") && !isFromAppSearch(""));
  check(
    "blockedFromApp: home and Pricing only",
    blockedFromApp("/") && blockedFromApp("/pricing") && blockedFromApp("/pricing/x") && !blockedFromApp("/privacy") && !blockedFromApp("/terms") && !blockedFromApp("/trust") && !blockedFromApp("/faq") && !blockedFromApp("/dashboard") && !blockedFromApp("/pricingx")
  );

  const { aiImprovementAllowed, publicPreferences } = aiImprovement;
  const base = { units: "metric", reminders: true, weekly_report: true, tone: "gentle" };
  check("ai improvement: never chosen (absent) is off", !aiImprovementAllowed(base) && publicPreferences(base).ai_training_opt_out === true);
  check("ai improvement: stored true is off", publicPreferences({ ...base, ai_training_opt_out: true }).ai_training_opt_out === true);
  check("ai improvement: stored false (the member's own switch) stays on", aiImprovementAllowed({ ...base, ai_training_opt_out: false }) && publicPreferences({ ...base, ai_training_opt_out: false }).ai_training_opt_out === false);
  check("ai improvement: missing preferences are off", publicPreferences(undefined).ai_training_opt_out === true && !aiImprovementAllowed(null));
  check("publicPreferences keeps the other preferences", JSON.stringify(publicPreferences({ ...base, ai_training_chosen_at: "x" })) === JSON.stringify({ ...base, ai_training_chosen_at: "x", ai_training_opt_out: true }));
}

/* ───────────────────────────── HTTP helpers ───────────────────────────── */

const APP = { "X-ORZA-Client": "mobile", "X-ORZA-Device": "d3-check", "X-ORZA-Platform": "ios" };
let token = "";
let cookie = "";

async function call(method, path, body, as = "app") {
  const headers = { "content-type": "application/json" };
  if (as === "app") Object.assign(headers, APP, token ? { authorization: `Bearer ${token}` } : {});
  if (as === "web") Object.assign(headers, { origin: BASE, ...(cookie ? { cookie } : {}) });
  const res = await fetch(`${BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, res };
}

/** A page request (no redirects followed). */
async function page(path, { withCookie = false } = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual", headers: withCookie && cookie ? { cookie } : {} });
  return { status: res.status, location: res.headers.get("location") || "", html: res.status === 200 ? await res.text() : "" };
}

const prefsOf = (r) => r.json.user?.preferences || {};

/** Answers for every onboarding step; drives the conversation to the end. `age` is the age step's answer. */
async function finishOnboarding(age = 30, as = "app") {
  const answers = { goal: "maintain", sex: "female", age, height: "165 cm", weight: "60 kg", activity: "light", diet: "vegetarian", allergies: ["none"], region: "Maharashtra", language: "en", household: "individual", lifestyle: "skip", summary: "confirm" };
  let state = await call("GET", "/onboarding", undefined, as);
  let step = state.json.step;
  for (let i = 0; i < 20 && step && step !== "complete"; i++) {
    const r = await call("POST", "/onboarding/step", { step, answer: answers[step] ?? "skip" }, as);
    if (r.json.done) return r;
    if (r.json.valid === false) return r;
    step = r.json.step;
  }
  return state;
}

/* ───────────────────────────── D1 + D2: phone-app account ───────────────────────────── */

const email = `d3-check-${randomBytes(4).toString("hex")}@orza.test`;
const reg = await call("POST", "/auth/register", { name: "D3 Check", email, password: `pw-${randomBytes(8).toString("hex")}` });
token = reg.json.token || "";
check("app sign-up works", reg.status === 201 && !!token, { status: reg.status, error: reg.json.error });
check("D2 new account: Help improve ÖRZA's AI is off (ai_training_opt_out true)", prefsOf(reg).ai_training_opt_out === true, prefsOf(reg));
check("D2 new account: no ai_training_chosen_at", !("ai_training_chosen_at" in prefsOf(reg)), prefsOf(reg));

// D1 onboarding
{
  let s = await call("GET", "/onboarding");
  for (const [step, answer] of [["goal", "maintain"], ["sex", "female"]]) {
    if (s.json.step === step || s.json.prompt?.step === step) s = await call("POST", "/onboarding/step", { step, answer });
  }
  check("onboarding reached the age step", s.json.step === "age", { step: s.json.step });
  check("D1 the age prompt says min 18", s.json.prompt?.min === 18 && s.json.prompt?.max === 100, s.json.prompt);
  const r17 = await call("POST", "/onboarding/step", { step: "age", answer: "17" });
  check("D1 onboarding refuses 17", r17.json.valid === false && r17.json.step === "age" && /aged 18 and over/.test(r17.json.error || ""), { valid: r17.json.valid, step: r17.json.step, error: r17.json.error });
  const r13 = await call("POST", "/onboarding/step", { step: "age", answer: 13 });
  check("D1 onboarding refuses 13 (the old minimum)", r13.json.valid === false && r13.json.step === "age", { valid: r13.json.valid, error: r13.json.error });
  const r101 = await call("POST", "/onboarding/step", { step: "age", answer: "101" });
  check("D1 onboarding refuses 101 with the 18–100 range", r101.json.valid === false && /between 18 and 100/.test(r101.json.error || ""), r101.json.error);
  const r18 = await call("POST", "/onboarding/step", { step: "age", answer: "18" });
  check("D1 onboarding accepts 18", r18.json.valid === true && r18.json.step === "height" && r18.json.answers?.age === 18, { valid: r18.json.valid, step: r18.json.step });
}

// D2: the member's own choice before finishing onboarding survives it
{
  const on = await call("PUT", "/settings/preferences", { ai_training_opt_out: false });
  check("D2 PUT false turns it on", on.status === 200 && prefsOf(on).ai_training_opt_out === false, prefsOf(on));
  check("D2 the choice stores ai_training_chosen_at", typeof prefsOf(on).ai_training_chosen_at === "string" && !Number.isNaN(Date.parse(prefsOf(on).ai_training_chosen_at)), prefsOf(on));
  const done = await finishOnboarding();
  check("onboarding completes", done.json.done === true, { step: done.json.step, error: done.json.error });
  check("D2 finishing onboarding keeps the member's on", prefsOf(done).ai_training_opt_out === false, prefsOf(done));
  check("D1 onboarding saved age 18", done.json.user?.profile?.age === 18, done.json.user?.profile);
  const units = await call("PUT", "/settings/preferences", { units: "imperial" });
  check("D2 another preference save keeps it on and the time", prefsOf(units).ai_training_opt_out === false && prefsOf(units).ai_training_chosen_at === prefsOf(on).ai_training_chosen_at, prefsOf(units));
  const off = await call("PUT", "/settings/preferences", { ai_training_opt_out: true });
  check("D2 PUT true turns it off", prefsOf(off).ai_training_opt_out === true && typeof prefsOf(off).ai_training_chosen_at === "string", prefsOf(off));
  const me = await call("GET", "/auth/me");
  check("D2 /auth/me shows the effective value", me.json.user?.preferences?.ai_training_opt_out === true, me.json.user?.preferences);
  const bad = await call("PUT", "/settings/preferences", { ai_training_opt_out: "yes" });
  check("D2 a non-boolean is refused", bad.status === 400, { status: bad.status });
  await call("PUT", "/settings/preferences", { units: "metric" });
}

// D1 profile and goal planner
{
  const p17 = await call("PUT", "/profile", { profile: { age: 17 } });
  check("D1 PUT /api/profile refuses 17", p17.status === 400 && /18 and up/.test(p17.json.error || ""), { status: p17.status, error: p17.json.error });
  const p18 = await call("PUT", "/profile", { profile: { age: 18 } });
  check("D1 PUT /api/profile accepts 18", p18.status === 200 && p18.json.user?.profile?.age === 18, { status: p18.status, error: p18.json.error });
  const g17 = await call("POST", "/goals/calculate", { goal: "maintain", current_weight_kg: 60, height_cm: 165, age: 17, sex: "female", activity_level: "light" });
  check("D1 POST /api/goals/calculate refuses 17", g17.status === 400 && /18 and up/.test(g17.json.error || ""), { status: g17.status, error: g17.json.error });
  const name = await call("PUT", "/profile", { name: "D3 Check Renamed" });
  check("D1 a profile save without age still works", name.status === 200, { status: name.status, error: name.json.error });
}

/* ───────────────────────────── Website account (cookie) ───────────────────────────── */

const webEmail = `d3-check-web-${randomBytes(4).toString("hex")}@orza.test`;
const webReg = await call("POST", "/auth/register", { name: "D3 Web", email: webEmail, password: `pw-${randomBytes(8).toString("hex")}` }, "web");
cookie = (webReg.res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
check("website sign-up works", webReg.status === 201 && cookie.includes("orza_session="), { status: webReg.status });
check("D2 website account starts off", prefsOf(webReg).ai_training_opt_out === true, prefsOf(webReg));

/* ───────────────────────────── D5 redirects ───────────────────────────── */

{
  const out = await page("/dashboard/health?from=app");
  const loc = new URL(out.location, BASE);
  check(
    "D5 signed out: /dashboard/health?from=app → /login keeps from=app",
    out.status >= 300 && out.status < 400 && loc.pathname === "/login" && loc.searchParams.get("from") === "app" && loc.searchParams.get("next") === "/dashboard/health?from=app",
    { status: out.status, location: out.location }
  );
  const plain = await page("/dashboard/health");
  check("D5 signed out without from=app: no from=app added", new URL(plain.location, BASE).searchParams.get("from") === null, plain.location);

  const notOnboarded = await page("/dashboard/health?from=app", { withCookie: true });
  const l2 = new URL(notOnboarded.location || "/", BASE);
  check("D5 not onboarded: the layout's /onboarding redirect keeps from=app", l2.pathname === "/onboarding" && l2.searchParams.get("from") === "app", { status: notOnboarded.status, location: notOnboarded.location });
  const notOnboardedPlain = await page("/dashboard/health", { withCookie: true });
  check("D5 not onboarded without from=app: plain /onboarding", new URL(notOnboardedPlain.location || "/", BASE).search === "", notOnboardedPlain.location);

  const web = await finishOnboarding(40, "web");
  check("website onboarding completes", web.json.done === true, { step: web.json.step, error: web.json.error });
  const onb = await page("/onboarding?from=app", { withCookie: true });
  const l3 = new URL(onb.location || "/", BASE);
  check("D5 onboarded: /onboarding?from=app → /dashboard?from=app", l3.pathname === "/dashboard" && l3.searchParams.get("from") === "app", { status: onb.status, location: onb.location });
  const dash = await page("/dashboard/health?from=app", { withCookie: true });
  check("D5 an app-opened account page renders (200)", dash.status === 200, { status: dash.status, location: dash.location });
  check("D5 the app shell's app-only top bar is in the page", dash.html.includes("app:lg:flex") && dash.html.includes("app:hidden"), "no app: classes");
}

/* ───────────────────────────── D3 privacy + trust, D5 script and CSS ───────────────────────────── */

const unescape = (h) => h.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/<!-- -->/g, "");
{
  const priv = await page("/privacy");
  const text = unescape(priv.html);
  check("D3 privacy page loads", priv.status === 200, { status: priv.status });
  check("D3 service providers line", text.includes("They may use it only to provide their service to ÖRZA and must protect it at least as well as this policy does."));
  check("D3 location line", text.includes("and ÖRZA never reads your phone's location.") && !text.includes("never collects your location"));
  check("D3 who is responsible (section + name)", text.includes('id="responsible"') && text.includes("Who is responsible for your information") && text.includes("Kunal Patil"));
  check("D3 grievance contact", text.includes("mailto:support@orza.app?subject=Privacy%20grievance") && text.includes("Data Protection Board of India"));
  check("D3 date 13 November 2026", text.includes("13 November 2026") && !text.includes("12 November 2026"));
  check("D2 privacy: opt-in wording, no opt-out wording", text.includes("only if you turn on") && text.includes("It's off unless you turn it on") && !/unless you opt out|You can opt out at any time|opt out of your anonymized/.test(text));

  const trust = unescape((await page("/trust")).html);
  check("D2 trust page: AI training is off unless turned on", trust.includes("Off unless you turn it on") && !trust.includes("Opt-out available in Settings") && !trust.includes("Your conversations improve"));

  const terms = unescape((await page("/terms")).html);
  check("D5 terms: the Pricing link has a plain-text twin for the app", /hidden app:inline[^>]*>Pricing</.test(terms));

  // The inline script, run in a sandbox: what the browser does before the first paint.
  const script = (priv.html.match(/<script>(\(function\(\)\{var d=document\.documentElement[\s\S]*?)<\/script>/) || [])[1];
  check("D5 the from=app script is inlined in <head>", !!script && priv.html.indexOf(script) < priv.html.indexOf("<body"), "script not found");
  check("D5 the server HTML has no data-from-app (normal visitors)", !/<html[^>]*data-from-app/.test(priv.html));
  const run = (search, store, pathname = "/privacy") => {
    const attrs = {};
    const ctx = {
      location: { search, pathname },
      URLSearchParams,
      document: { documentElement: { setAttribute: (k, v) => (attrs[k] = v) } },
      window: {},
    };
    Object.defineProperty(ctx.window, "sessionStorage", {
      get() {
        if (store === "blocked") throw new Error("SecurityError");
        return { setItem: (k, v) => (store[k] = String(v)), getItem: (k) => (k in store ? store[k] : null) };
      },
    });
    vm.runInNewContext(script || "", ctx);
    return attrs;
  };
  if (script) {
    const tab = {};
    check("D5 script: ?from=app marks the page and stores its path", "data-from-app" in run("?from=app", tab) && tab["orza.fromApp"] === "/privacy", tab);
    check("D5 script: the next page in that tab stays marked", "data-from-app" in run("", tab, "/terms") && tab["orza.fromApp"] === "/privacy", tab);
    check("D5 script: another tab without from=app is not marked", !("data-from-app" in run("", {})));
    check("D5 script: ?from=web is not marked", !("data-from-app" in run("?from=web", {})));
    check("D5 script: blocked storage still marks a from=app page", "data-from-app" in run("?from=app", "blocked"));
    check("D5 script: blocked storage, no from=app: not marked", !("data-from-app" in run("", "blocked")));
  }

  const css = [...priv.html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]);
  let cssText = "";
  for (const href of css) cssText += await (await fetch(new URL(href, BASE))).text();
  check("D5 the app: variant is in the CSS", /html\[data-from-app\] \.app\\:hidden\s*\{\s*display:\s*none/.test(cssText) && /html\[data-from-app\] \.app\\:flex/.test(cssText), `${css.length} stylesheet(s)`);
  check("D5 nav and footer carry app: classes", priv.html.includes('aria-label="Primary" class="hidden items-center gap-6 lg:flex app:hidden"') && priv.html.includes('aria-label="Legal" class="hidden flex-wrap gap-x-6 gap-y-3 app:flex"'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
