#!/usr/bin/env node
/**
 * Checks the steps v2 server contract against a running ÖRZA server (local by default):
 * `POST /api/track/steps` modes (manual / auto / reconcile, `edit_ref`, `expect` → `{tracking, applied, reason}`; no
 * mode = the old plain set, no marker), the `steps_edited_at` marker in answers, the health-sync mirror never raising an edited day, step totals for a future day
 * being dropped, and `GET /api/health/days` showing the tracked step count.
 *
 *   npm run dev                                   (another terminal; the JSON-file database when MONGODB_URI is unset)
 *   node scripts/check-steps-modes.mjs            → http://localhost:3100
 *   ORZA_BASE_URL=http://localhost:3101 node scripts/check-steps-modes.mjs
 *
 * Each run signs up a new throwaway account (`steps-check-…@orza.test`, as the phone app does) and writes only to its
 * days, so it never touches anyone's data; the account is left in the database. It refuses any host other than
 * localhost / 127.0.0.1 / [::1] / *.localhost / *.test unless ORZA_CHECK_ALLOW_REMOTE=1 (never point it at production).
 * Exit code 1 when a check fails.
 */
import { randomBytes } from "node:crypto";

const BASE = (process.env.ORZA_BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const host = new URL(BASE).hostname.replace(/^\[|\]$/g, "").toLowerCase();
const local = ["localhost", "127.0.0.1", "::1"].includes(host) || host.endsWith(".localhost") || host.endsWith(".test");
if (!local && process.env.ORZA_CHECK_ALLOW_REMOTE !== "1") {
  console.error(`Refusing to run against ${BASE}: it signs up a test account and writes step data. Set ORZA_CHECK_ALLOW_REMOTE=1 for a test server.`);
  process.exit(2);
}

const APP = { "X-ORZA-Client": "mobile", "X-ORZA-Device": "steps-check", "X-ORZA-Platform": "android" };
let token = "";

async function call(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...APP, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

let failed = 0;
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
const skip = (name, why) => console.log(`SKIP  ${name} — ${why}`);

/** The parts of a `POST /api/track/steps` answer the checks compare. */
const outcome = (r) => ({
  status: r.status,
  steps: r.json.tracking?.steps,
  applied: r.json.applied,
  reason: r.json.reason,
  marker: r.json.tracking && "steps_edited_at" in r.json.tracking ? r.json.tracking.steps_edited_at : "(missing)",
  ...(r.json.error ? { error: r.json.error } : {}),
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const steps = (body) => call("POST", "/track/steps", body);
const dayOf = async (date) => (await call("GET", `/dashboard/today?date=${date}`)).json;
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function main() {
  console.log(`Server: ${BASE}`);
  const email = `steps-check-${Date.now()}-${randomBytes(3).toString("hex")}@orza.test`;
  const reg = await call("POST", "/auth/register", { name: "Steps check", email, password: randomBytes(18).toString("base64url") });
  if (reg.status !== 201 || !reg.json.token) {
    console.error(`Sign-up failed (${reg.status}): ${JSON.stringify(reg.json).slice(0, 200)}`);
    process.exit(2);
  }
  token = reg.json.token;
  console.log(`Account: ${email}`);

  const today = (await dayOf("")).today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || "")) throw new Error("GET /api/dashboard/today gave no `today`");
  const D1 = addDays(today, -3); // edited by the member
  const D2 = addDays(today, -4); // automatic saves only
  const D3 = addDays(today, -5); // typed steps, no health data
  const D4 = addDays(today, -6); // saved without a mode (an app build from before the modes)
  const D5 = addDays(today, -7); // edited, then saved without a mode
  const TOMORROW = addDays(today, 1);

  /* ── B1: modes ── */
  let r = await steps({ steps: 4000, date: D1, mode: "manual" });
  if (!("applied" in r.json)) {
    console.error(`This server answers ${JSON.stringify(r.json).slice(0, 160)} — no step modes (an older build).`);
    process.exit(1);
  }
  check("manual: applied, sets steps_edited_at", r.status === 200 && r.json.applied === true && r.json.tracking.steps === 4000 && typeof r.json.tracking.steps_edited_at === "string", outcome(r));
  const before = r.json.tracking.steps_edited_at;
  r = await steps({ steps: 4200, date: D1, mode: "manual" }); // the website's form
  const M = r.json.tracking?.steps_edited_at;
  check("manual again (the website's form): applied, marker refreshed", r.status === 200 && r.json.applied === true && r.json.tracking.steps === 4200 && typeof M === "string" && M >= before, outcome(r));

  r = await steps({ steps: 9000, date: D1, mode: "auto", edit_ref: null });
  check("auto when a marker exists and edit_ref is null → edited", same(outcome(r), { status: 200, steps: 4200, applied: false, reason: "edited", marker: M }), outcome(r));
  r = await steps({ steps: 9000, date: D1, mode: "auto", edit_ref: M });
  check("auto with the matching edit_ref → applied", same(outcome(r), { status: 200, steps: 9000, applied: true, marker: M }), outcome(r));
  r = await steps({ steps: 8000, date: D1, mode: "auto", edit_ref: M });
  check("auto lower → not_higher", same(outcome(r), { status: 200, steps: 9000, applied: false, reason: "not_higher", marker: M }), outcome(r));

  r = await steps({ steps: 5000, date: D2, mode: "auto", edit_ref: null });
  check("auto higher with no marker → applied", same(outcome(r), { status: 200, steps: 5000, applied: true, marker: null }), outcome(r));
  r = await steps({ steps: 4500, date: D2, mode: "reconcile", expect: 5000, edit_ref: null });
  check("reconcile when expect matches → applied", same(outcome(r), { status: 200, steps: 4500, applied: true, marker: null }), outcome(r));
  r = await steps({ steps: 4000, date: D2, mode: "reconcile", expect: 5000, edit_ref: null });
  check("reconcile when expect doesn't match → changed", same(outcome(r), { status: 200, steps: 4500, applied: false, reason: "changed", marker: null }), outcome(r));
  r = await steps({ steps: 100, date: D1, mode: "reconcile", expect: 9000, edit_ref: null });
  check("reconcile over an unseen edit → edited", same(outcome(r), { status: 200, steps: 9000, applied: false, reason: "edited", marker: M }), outcome(r));
  r = await steps({ steps: 4000, date: D2, mode: "reconcile" });
  check("reconcile without expect → 400", r.status === 400, outcome(r));

  /* ── B1: no mode — app builds from before the modes send their automatic saves this way ── */
  r = await steps({ steps: 6000, date: D4 });
  check("no mode (app builds before v2): applied, no marker", same(outcome(r), { status: 200, steps: 6000, applied: true, marker: null }), outcome(r));
  r = await steps({ steps: 7000, date: D4, mode: "auto", edit_ref: null });
  check("auto after a no-mode save → applied (the day isn't frozen)", same(outcome(r), { status: 200, steps: 7000, applied: true, marker: null }), outcome(r));
  const M5 = (await steps({ steps: 2000, date: D5, mode: "manual" })).json.tracking?.steps_edited_at;
  r = await steps({ steps: 2500, date: D5 });
  check("no mode on an edited day: steps set, marker left as it was", typeof M5 === "string" && same(outcome(r), { status: 200, steps: 2500, applied: true, marker: M5 }), outcome(r));

  /* ── B2: the marker in the day's row ── */
  const d1 = await dayOf(D1);
  const d2 = await dayOf(D2);
  check("GET /api/dashboard/today: an edited day carries its marker", d1.tracking?.steps_edited_at === M, d1.tracking);
  check("GET /api/dashboard/today: an unedited day has steps_edited_at: null", d2.tracking && "steps_edited_at" in d2.tracking && d2.tracking.steps_edited_at === null, d2.tracking);

  /* ── B3: the health-sync mirror and future-dated steps ── */
  r = await call("POST", "/health/import", {
    source: "health_connect",
    days: [
      { date: D1, steps: 20000, sleep_minutes: 420 },
      { date: D2, steps: 7000 },
      { date: D4, steps: 8000 },
      { date: TOMORROW, steps: 999, sleep_minutes: 400 },
    ],
  });
  check("health import accepted", r.status === 200 && r.json.ok === true, r.json);
  check("mirror on an edited day → no raise", (await dayOf(D1)).tracking?.steps === 9000, (await dayOf(D1)).tracking);
  check("mirror on an unedited day → raised (control)", (await dayOf(D2)).tracking?.steps === 7000, (await dayOf(D2)).tracking);
  check("mirror on a day saved without a mode → raised", (await dayOf(D4)).tracking?.steps === 8000, (await dayOf(D4)).tracking);
  r = await call("GET", `/health/days?from=${TOMORROW}&to=${TOMORROW}`);
  const tomorrow = r.json.days?.find((d) => d.date === TOMORROW);
  check("steps for tomorrow dropped, the day's other metrics kept", tomorrow && tomorrow.sleep_minutes === 400 && tomorrow.steps === undefined, r.json.days);

  /* ── B4: one step number on the Health screen ── */
  await steps({ steps: 3000, date: D3, mode: "manual" });
  r = await call("GET", `/health/days?from=${D3}&to=${D1}`);
  const day = (date) => r.json.days?.find((d) => d.date === date);
  check("GET /api/health/days: steps = tracking.steps on an edited day (not the synced 20000)", day(D1)?.steps === 9000 && day(D1)?.sleep_minutes === 420, day(D1));
  check("GET /api/health/days: steps = tracking.steps on a synced day", day(D2)?.steps === 7000, day(D2));
  check("GET /api/health/days: a day with typed steps only is listed (sources: [])", same(day(D3), { date: D3, sources: [], steps: 3000 }), day(D3));

  /* ── B5 ── */
  skip("coach prompt has no steps", "B5 isn't part of this batch (the coach keeps steps on the web until the app-wide AI consent ships)");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
