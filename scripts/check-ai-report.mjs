#!/usr/bin/env node
/**
 * Checks the AI report contract against a running ÖRZA server (local by default): POST /api/ai/reports (own items only,
 * 404 otherwise; one report per member per item, a second one replaces it; no AI consent needed; the minute limit), the
 * website cookie path and the cross-site guard, the admin APIs refusing members, and — with a local admin account — the
 * admin list (snapshot, member email, filters), the Reviewed switch, a re-report going back to review, the snapshot
 * outliving the item, the data export and account deletion. See src/lib/ai-reports.ts and docs/notes/ai-report.md (mobile).
 *
 *   npx next dev -p 3101                                      (another terminal; no .env.local: JSON-file database, AI off)
 *   ORZA_BASE_URL=http://localhost:3101 node scripts/check-ai-report.mjs
 *   ORZA_ADMIN_EMAIL=… ORZA_ADMIN_PASSWORD=… ORZA_BASE_URL=… node scripts/check-ai-report.mjs   (adds the admin checks)
 *   ORZA_CHECK_DAY_LIMIT=1 …                                  (adds the 30-items-a-day limit; about 3 more minutes)
 *
 * It makes no AI calls: it stops unless the server says `ai_enabled: false`, so the chat reply, recipe, plan and meal it
 * reports come from the built-in coach, the curated collection, the built-in plan and the food list.
 * Each run signs up throwaway accounts (`ai-report-check-…@orza.test`) and deletes them at the end. It refuses
 * any host other than localhost / 127.0.0.1 / [::1] / *.localhost / *.test unless ORZA_CHECK_ALLOW_REMOTE=1 (never point
 * it at production). Exit code 1 when a check fails.
 */
import { randomBytes } from "node:crypto";

const BASE = (process.env.ORZA_BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const host = new URL(BASE).hostname.replace(/^\[|\]$/g, "").toLowerCase();
const local = ["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".localhost") || host.endsWith(".test");
if (!local && process.env.ORZA_CHECK_ALLOW_REMOTE !== "1") {
  console.error(`Refusing to run against ${BASE}: it signs up test accounts. Set ORZA_CHECK_ALLOW_REMOTE=1 for a test server.`);
  process.exit(2);
}

const APP = { "X-ORZA-Client": "mobile", "X-ORZA-Device": "ai-report-check", "X-ORZA-Platform": "android" };

/**
 * One request as `who`: {token} (the app's Bearer + app headers), {app: true} (the app's headers, signed out: its sign-in),
 * {cookie} (the website, same-origin) or null (signed out).
 */
async function call(method, path, body, who) {
  const headers = { "content-type": "application/json" };
  if (who?.token || who?.app) Object.assign(headers, APP);
  if (who?.token) headers.authorization = `Bearer ${who.token}`;
  if (who?.cookie) Object.assign(headers, { origin: BASE, cookie: who.cookie });
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

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);
const brief = (r) => ({ status: r.status, code: r.json.code, error: r.json.error });
const report = (who, body) => call("POST", "/ai/reports", body, who);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** A report that waits out the minute limit (its 429 has Retry-After; the day's has none). */
async function paced(who, body) {
  for (;;) {
    const r = await report(who, body);
    const wait = Number(r.res.headers.get("retry-after"));
    if (r.status !== 429 || !wait) return r;
    await sleep(wait * 1000 + 250);
  }
}

/** Members besides A, deleted at the end. */
const extra = [];

/** A new member (app sign-up) with AI consent, so the built-in features answer. */
async function member(label) {
  const email = `ai-report-check-${label}-${Date.now()}-${randomBytes(3).toString("hex")}@orza.test`;
  const password = randomBytes(18).toString("base64url");
  const reg = await call("POST", "/auth/register", { name: `AI report check ${label}`, email, password }, { app: true });
  if (reg.status !== 201 || !reg.json.token) throw new Error(`Sign-up failed (${reg.status}): ${JSON.stringify(reg.json).slice(0, 200)}`);
  const who = { token: reg.json.token, email, password, id: reg.json.user.id };
  const put = await call("PUT", "/settings/ai-consent", { version: 1 }, who);
  if (put.status !== 200) throw new Error(`AI consent failed (${put.status})`);
  return who;
}

/** A built-in chat reply: {reply, mine} = the assistant message and the member's own message. */
async function chatReply(who, message) {
  const r = await call("POST", "/chat/send", { message }, who);
  if (r.status !== 200) throw new Error(`chat/send failed (${r.status}): ${JSON.stringify(r.json).slice(0, 200)}`);
  return { reply: r.json.message, mine: r.json.user_message };
}

async function webCookie(who) {
  const login = await call("POST", "/auth/login", { email: who.email, password: who.password }, null);
  const set = login.res.headers.getSetCookie?.() ?? [];
  return set.map((c) => c.split(";")[0]).find((c) => c.startsWith("orza_session=") && c.length > "orza_session=".length) || null;
}

async function main() {
  console.log(`Server: ${BASE}`);
  const a = await member("a");
  const balance = await call("GET", "/credits/balance", undefined, a);
  if (balance.json.ai_enabled !== false) {
    console.error(`This server has the AI on (ai_enabled: ${balance.json.ai_enabled}). The check would call it: use a server with the AI off.`);
    process.exit(2);
  }
  console.log(`Account: ${a.email} (ai_enabled: false)`);

  /* ── Items to report (all built-in: the AI is off) ── */
  const { reply, mine } = await chatReply(a, "hi");
  const recipe = (await call("POST", "/recipes/generate", {}, a)).json.recipe;
  const plan = (await call("POST", "/compensation/plan", { occasion: "Wedding", extra_calories: 600 }, a)).json.plan;
  const textMeal = (await call("POST", "/meals/text", { text: "2 roti and dal" }, a)).json.meal;
  const food = (await call("GET", "/foods/search?q=roti", undefined, a)).json.foods?.[0];
  const manualMeal = food ? (await call("POST", "/meals/manual", { meal_type: "lunch", food_key: food.key, quantity: 1 }, a)).json.meal : null;
  check(
    "setup: a built-in reply, a curated recipe, a built-in plan, a food-list meal",
    reply?.role === "assistant" && reply.meta?.ai === false && recipe?.source === "library" && plan?.ai === false && textMeal?.source === "text",
    { reply: reply?.meta, recipe: recipe?.source, plan: plan?.ai, meal: textMeal?.source }
  );

  /* ── 401 ── */
  let r = await report(null, { kind: "chat", ref_id: reply.id, reason: "offensive" });
  check("signed out → 401", r.status === 401, brief(r));

  /* ── 400s (member B; they count toward B's minute) ── */
  const b = await member("b");
  extra.push(b);
  const { reply: bReply } = await chatReply(b, "hello");
  for (const [label, body] of [
    ["{}", {}],
    ["unknown kind", { kind: "rx", ref_id: bReply.id, reason: "wrong" }],
    ["unknown reason", { kind: "chat", ref_id: bReply.id, reason: "spam" }],
    ["empty ref_id", { kind: "chat", ref_id: "   ", reason: "wrong" }],
    ["note over 500", { kind: "chat", ref_id: bReply.id, reason: "other", note: "x".repeat(501) }],
    ["note not text", { kind: "chat", ref_id: bReply.id, reason: "other", note: 5 }],
  ]) {
    r = await report(b, body);
    check(`${label} → 400 validation`, r.status === 400 && r.json.code === "validation", brief(r));
  }

  /* ── The minute limit: B has used 6 of 10 (every signed-in attempt counts) ── */
  let limited = null;
  for (let i = 0; i < 6 && !limited; i++) {
    r = await report(b, { kind: "chat", ref_id: bReply.id, reason: "other" });
    if (r.status === 429) limited = { r, at: i };
  }
  check(
    "the 11th report in a minute → 429 rate_limited with Retry-After",
    limited && limited.at === 4 && limited.r.json.code === "rate_limited" && Number(limited.r.res.headers.get("retry-after")) > 0,
    limited ? { at: limited.at, ...brief(limited.r), retry: limited.r.res.headers.get("retry-after") } : "never limited"
  );
  check("429 text", limited?.r.json.error === "You've sent several reports in a row. Please try again in 1 minute.", limited?.r.json.error);

  /* ── 30 items a day (member E; about 3 minutes, as the minute limit paces it) ── */
  if (process.env.ORZA_CHECK_DAY_LIMIT === "1") {
    const e = await member("e");
    extra.push(e);
    const meals = [];
    for (let i = 0; i < 31; i++) meals.push((await call("POST", "/meals/text", { text: "1 roti" }, e)).json.meal);
    let sent = 0;
    for (const m of meals.slice(0, 30)) if ((await paced(e, { kind: "meal", ref_id: m.id, reason: "wrong" })).status === 201) sent++;
    check("30 different items in a day → 201 each", sent === 30, `${sent} of 30`);
    r = await paced(e, { kind: "meal", ref_id: meals[30].id, reason: "wrong" });
    check(
      "the 31st item → 429 rate_limited (the day's text)",
      r.status === 429 && r.json.code === "rate_limited" && r.json.error === "You've sent a lot of reports today. Thank you, the team will look at them.",
      brief(r)
    );
    r = await paced(e, { kind: "meal", ref_id: meals[0].id, reason: "offensive" });
    check("…changing one of those 30 → 200", r.status === 200 && r.json.report?.reason === "offensive", brief(r));
  } else skip("30 reported items a day → 429", "set ORZA_CHECK_DAY_LIMIT=1 (about 3 minutes: the minute limit paces it)");

  /* ── 404s (member D: nothing of anyone else's, nothing ÖRZA didn't write) ── */
  const d = await member("d");
  extra.push(d);
  const { reply: dReply, mine: dMine } = await chatReply(d, "namaste");
  const dManual = food ? (await call("POST", "/meals/manual", { meal_type: "snack", food_key: food.key, quantity: 1 }, d)).json.meal : null;
  const notFound = (r) => r.status === 404 && r.json.code === "not_found";
  for (const [label, body] of [
    ["an unknown id", { kind: "chat", ref_id: "00000000-0000-4000-8000-000000000000", reason: "wrong" }],
    ["another member's reply", { kind: "chat", ref_id: reply.id, reason: "offensive" }],
    ["another member's recipe", { kind: "recipe", ref_id: recipe.id, reason: "unsafe" }],
    ["their own chat message", { kind: "chat", ref_id: dMine.id, reason: "other" }],
    ["their own reply sent as a recipe", { kind: "recipe", ref_id: dReply.id, reason: "other" }],
  ]) {
    r = await report(d, body);
    check(`${label} → 404 not_found`, notFound(r), brief(r));
  }
  if (dManual) {
    r = await report(d, { kind: "meal", ref_id: dManual.id, reason: "wrong" });
    check("a manual meal → 404 not_found", notFound(r), brief(r));
  } else skip("a manual meal → 404", "no food found for the manual meal");
  check("404 text", r.json.error === "We couldn't find that to report. It may have been deleted.", r.json.error);

  /* ── 201 / 200: one report per item (member A) ── */
  r = await report(a, { kind: "chat", ref_id: reply.id, reason: "offensive", note: "  rude\r\n\r\n\r\n\r\nreply  " });
  const first = r.json.report;
  check(
    "first report → 201 {report: {id, kind, ref_id, reason, note, created_at, updated_at}}",
    r.status === 201 && first?.kind === "chat" && first.ref_id === reply.id && first.reason === "offensive" && first.created_at === first.updated_at,
    { status: r.status, report: first }
  );
  check("note trimmed, line breaks kept, blank runs folded", first?.note === "rude\n\nreply", first?.note);
  check(
    "the member's answer has no snapshot, review state or ids of others",
    first && !("text" in first) && !("reviewed" in first) && !("user_id" in first) && !("reviewed_by" in first),
    first
  );
  r = await report(a, { kind: "chat", ref_id: reply.id, reason: "wrong" });
  check(
    "second report of the item → 200, same report, reason replaced, note cleared",
    r.status === 200 && r.json.report?.id === first.id && r.json.report.reason === "wrong" && r.json.report.note === null &&
      r.json.report.created_at === first.created_at && r.json.report.updated_at >= first.updated_at,
    { status: r.status, report: r.json.report }
  );
  r = await report(a, { kind: "recipe", ref_id: recipe.id, reason: "unsafe", note: "has peanuts" });
  check("a recipe (curated) → 201", r.status === 201 && r.json.report?.kind === "recipe", brief(r));
  r = await report(a, { kind: "rebalance", ref_id: plan.id, reason: "other", note: null });
  check("a rebalance plan → 201 (note null accepted)", r.status === 201 && r.json.report?.note === null, brief(r));
  r = await report(a, { kind: "meal", ref_id: textMeal.id, reason: "wrong" });
  check("a typed meal → 201", r.status === 201 && r.json.report?.kind === "meal", brief(r));
  skip("a Snap & Know result (scan)", "scans need the AI; the loader is reviewed in src/lib/ai-reports.ts");

  /* ── No AI consent needed ── */
  r = await call("DELETE", "/settings/ai-consent", undefined, a);
  check("turn AI features off → 200", r.status === 200 && r.json.user?.ai_consent === null, brief(r));
  r = await report(a, { kind: "chat", ref_id: reply.id, reason: "offensive" });
  check("without AI consent a report still goes → 200", r.status === 200 && r.json.report?.id === first.id, brief(r));

  /* ── The website (cookie) and the cross-site guard ── */
  const cookie = await webCookie(a);
  if (!cookie) check("website sign-in sets the session cookie", false, "no orza_session cookie");
  else {
    const web = { cookie };
    r = await report(web, { kind: "recipe", ref_id: recipe.id, reason: "offensive" });
    check("website cookie → 200 (the same report, replaced)", r.status === 200 && r.json.report?.kind === "recipe" && r.json.report.reason === "offensive", brief(r));
    const foreign = await fetch(`${BASE}/api/ai/reports`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://not-orza.example", cookie },
      body: JSON.stringify({ kind: "chat", ref_id: reply.id, reason: "other" }),
    });
    const fj = await foreign.json().catch(() => ({}));
    check("website: a cross-site POST → 403 cross_site", foreign.status === 403 && fj.code === "cross_site", { status: foreign.status, code: fj.code });
  }

  /* ── Admin APIs refuse members ── */
  r = await call("GET", "/admin/ai-reports", undefined, a);
  check("member: GET /api/admin/ai-reports → 403", r.status === 403, brief(r));
  r = await call("PATCH", `/admin/ai-reports/${first.id}`, { reviewed: true }, a);
  check("member: PATCH /api/admin/ai-reports/[id] → 403", r.status === 403, brief(r));

  /* ── Export ── */
  const exp = await call("GET", "/account/export", undefined, a);
  const exported = exp.json.ai_reports || [];
  const expChat = exported.find((x) => x.id === first.id);
  check(
    "export: ai_reports with the snapshot, no review fields",
    exp.status === 200 && exported.length === 4 && expChat?.text === reply.content.trim() && !("reviewed" in expChat) && !("reviewed_by" in expChat),
    { status: exp.status, count: exported.length, keys: expChat && Object.keys(expChat) }
  );

  /* ── Admin (needs a local admin account) ── */
  const adminEmail = process.env.ORZA_ADMIN_EMAIL;
  const adminPassword = process.env.ORZA_ADMIN_PASSWORD;
  let admin = null;
  if (adminEmail && adminPassword) {
    const login = await call("POST", "/auth/login", { email: adminEmail, password: adminPassword }, { app: true });
    if (login.status === 200 && login.json.token && login.json.user?.is_admin) admin = { token: login.json.token };
    else check("admin sign-in", false, brief(login));
  }
  if (!admin) {
    skip("admin list, Reviewed, re-report, snapshot after delete, account deletion", "set ORZA_ADMIN_EMAIL and ORZA_ADMIN_PASSWORD (a local admin)");
  } else {
    const list = async (status) => (await call("GET", `/admin/ai-reports${status ? `?status=${status}` : ""}`, undefined, admin)).json;
    let all = await list();
    let row = all.reports?.find((x) => x.id === first.id);
    check(
      "admin: GET lists the report with the reply's text, ai false, app, the member's email",
      row && row.text === reply.content.trim() && row.ai === false && row.client === "app" && row.member?.email === a.email && row.reviewed === false,
      row
    );
    check("admin: newest first by updated_at", (all.reports || []).every((x, i, xs) => i === 0 || xs[i - 1].updated_at >= x.updated_at), all.reports?.map((x) => x.updated_at));
    check("admin: `open` counts reports to review", typeof all.open === "number" && all.open >= 4, all.open);
    const recipeRow = all.reports?.find((x) => x.kind === "recipe" && x.ref_id === recipe.id);
    check(
      "admin: the website's change is recorded (client web), recipe snapshot has title, ingredients, method",
      recipeRow?.client === "web" && recipeRow.text.startsWith(recipe.title) && recipeRow.text.includes("Ingredients") && recipeRow.text.includes("Method"),
      recipeRow && { client: recipeRow.client, text: recipeRow.text.slice(0, 120) }
    );
    r = await call("GET", "/admin/ai-reports?status=nope", undefined, admin);
    check("admin: unknown status → 400", r.status === 400, brief(r));

    r = await call("PATCH", `/admin/ai-reports/${first.id}`, { reviewed: true }, admin);
    check("admin: PATCH reviewed true → 200 {ok}", r.status === 200 && r.json.ok === true, brief(r));
    row = (await list("reviewed")).reports?.find((x) => x.id === first.id);
    check("admin: status=reviewed has it, with reviewed_at", row?.reviewed === true && typeof row.reviewed_at === "string", row);
    check("admin: status=open doesn't", !(await list("open")).reports?.some((x) => x.id === first.id));
    r = await call("PATCH", `/admin/ai-reports/${first.id}`, { reviewed: "yes" }, admin);
    check("admin: PATCH {reviewed: \"yes\"} → 400", r.status === 400 && r.json.code === "validation", brief(r));
    r = await call("PATCH", "/admin/ai-reports/00000000-0000-4000-8000-000000000000", { reviewed: true }, admin);
    check("admin: PATCH an unknown id → 404", r.status === 404, brief(r));

    // A changed report goes back to review.
    r = await report(a, { kind: "chat", ref_id: reply.id, reason: "unsafe", note: "again" });
    row = (await list("open")).reports?.find((x) => x.id === first.id);
    check("member reports again → back to review, reason and note replaced", r.status === 200 && row?.reviewed === false && row.reviewed_at === null && row.reason === "unsafe" && row.note === "again", row);
    r = await call("PATCH", `/admin/ai-reports/${first.id}`, { reviewed: false }, admin);
    check("admin: PATCH reviewed false → 200", r.status === 200, brief(r));

    // The snapshot outlives the item.
    r = await call("DELETE", `/recipes/${recipe.id}`, undefined, a);
    row = (await list()).reports?.find((x) => x.kind === "recipe" && x.ref_id === recipe.id);
    check("recipe deleted → the report and its snapshot stay", r.status === 200 && row?.text.startsWith(recipe.title), { status: r.status, row: !!row });

    const stats = await call("GET", "/admin/stats", undefined, admin);
    check("admin: stats.open_ai_reports is a number", typeof stats.json.open_ai_reports === "number" && stats.json.open_ai_reports >= 4, stats.json.open_ai_reports);
  }

  /* ── Account deletion takes the reports ── */
  r = await call("DELETE", "/account", { confirm: "DELETE" }, a);
  check("delete account A → 200", r.status === 200, brief(r));
  if (admin) {
    const left = (await call("GET", "/admin/ai-reports?limit=200", undefined, admin)).json.reports || [];
    check("…and its reports are gone", !left.some((x) => x.member?.email === a.email || x.id === first.id), left.filter((x) => x.id === first.id));
  } else skip("…and its reports are gone", "needs the admin list");
  for (const who of extra) await call("DELETE", "/account", { confirm: "DELETE" }, who);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
