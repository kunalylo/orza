#!/usr/bin/env node
/**
 * Checks the steps v2 server contract against a running ÖRZA server (local by default):
 * `POST /api/track/steps` modes (manual / auto / reconcile, `edit_ref`, `expect` → `{tracking, applied, reason}`; no
 * mode = the old plain set, no marker), the `steps_edited_at` marker and `steps_edited_value` in answers, the health-sync mirror never raising an edited day, step totals for a future day
 * being dropped, and `GET /api/health/days` showing the tracked step count.
 *
 *   npm run dev                                   (another terminal; the JSON-file database when MONGODB_URI is unset)
 *   node scripts/check-steps-modes.mjs            → http://localhost:3100
 *   ORZA_BASE_URL=http://localhost:3101 node scripts/check-steps-modes.mjs
 *   ORZA_CHECK_TOKEN=<session token> node scripts/check-steps-modes.mjs   (an existing local test account)
 *
 * By default each run signs up a new throwaway account (`steps-check-…@orza.test`, as the phone app does) and writes
 * only to its days; the account is left in the database. With ORZA_CHECK_TOKEN (a bearer session token of a test
 * account on that server, e.g. from `POST /api/auth/login`; never printed) it signs up nothing and writes only to days
 * that account has nothing on yet (no tracked steps, no edit marker, no health data), plus sleep for tomorrow (the
 * future-day check). It refuses any host other than localhost / 127.0.0.1 / [::1] / *.localhost / *.test unless
 * ORZA_CHECK_ALLOW_REMOTE=1 (never point it at production). Exit code 1 when a check fails.
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
let token = (process.env.ORZA_CHECK_TOKEN || "").trim();

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

/**
 * An existing account: the offset (days before today, at least 3) of the latest run of 5 consecutive days with no
 * health data, no tracked steps and no edit marker, so its own data never changes what a check expects.
 */
async function untouchedDays(today) {
  const SPAN = 5;
  const from = addDays(today, -399);
  const r = await call("GET", `/health/days?from=${from}&to=${addDays(today, -1)}`);
  if (r.status !== 200 || !Array.isArray(r.json.days)) throw new Error(`GET /api/health/days → ${r.status}`);
  const busy = new Set(r.json.days.map((d) => d.date)); // health data, or tracked steps > 0
  for (let k = 3; addDays(today, -k - SPAN + 1) >= from; k++) {
    const dates = Array.from({ length: SPAN }, (_, i) => addDays(today, -k - i));
    if (dates.some((d) => busy.has(d))) continue;
    let clean = true;
    for (const d of dates) {
      const t = (await dayOf(d)).tracking;
      if (!t || t.steps !== 0 || t.steps_edited_at) {
        busy.add(d);
        clean = false;
      }
    }
    if (clean) return k;
  }
  throw new Error("No 5 untouched days in the last 400 for this account");
}

async function main() {
  console.log(`Server: ${BASE}`);
  const existing = !!token;
  if (existing) {
    const me = await call("GET", "/auth/me");
    if (me.status !== 200 || !me.json.user?.email) {
      console.error(`ORZA_CHECK_TOKEN isn't a live session on this server (GET /api/auth/me → ${me.status}).`);
      process.exit(2);
    }
    console.log(`Account: ${me.json.user.email} (existing; only days it has nothing on are written)`);
  } else {
    const email = `steps-check-${Date.now()}-${randomBytes(3).toString("hex")}@orza.test`;
    const reg = await call("POST", "/auth/register", { name: "Steps check", email, password: randomBytes(18).toString("base64url") });
    if (reg.status !== 201 || !reg.json.token) {
      console.error(`Sign-up failed (${reg.status}): ${JSON.stringify(reg.json).slice(0, 200)}`);
      process.exit(2);
    }
    token = reg.json.token;
    console.log(`Account: ${email}`);
  }

  const today = (await dayOf("")).today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || "")) throw new Error("GET /api/dashboard/today gave no `today`");
  const first = existing ? await untouchedDays(today) : 3;
  const D1 = addDays(today, -first); // edited by the member
  const D2 = addDays(today, -first - 1); // automatic saves only
  const D3 = addDays(today, -first - 2); // typed steps, no health data
  const D4 = addDays(today, -first - 3); // saved without a mode (an app build from before the modes)
  const D5 = addDays(today, -first - 4); // edited, then saved without a mode
  const TOMORROW = addDays(today, 1);
  console.log(`Days: ${D5} … ${D1}`);

  /* ── B1: modes ── */
  let r = await steps({ steps: 4000, date: D1, mode: "manual" });
  if (!("applied" in r.json)) {
    console.error(`This server answers ${JSON.stringify(r.json).slice(0, 160)} — no step modes (an older build).`);
    process.exit(1);
  }
  check(
    "manual: applied, sets steps_edited_at and steps_edited_value",
    r.status === 200 && r.json.applied === true && r.json.tracking.steps === 4000 && typeof r.json.tracking.steps_edited_at === "string" && r.json.tracking.steps_edited_value === 4000,
    { ...outcome(r), value: r.json.tracking?.steps_edited_value }
  );
  const before = r.json.tracking.steps_edited_at;
  r = await steps({ steps: 4200, date: D1, mode: "manual" }); // the website's form
  const M = r.json.tracking?.steps_edited_at;
  check("manual again (the website's form): applied, marker refreshed", r.status === 200 && r.json.applied === true && r.json.tracking.steps === 4200 && typeof M === "string" && M >= before, outcome(r));

  r = await steps({ steps: 9000, date: D1, mode: "auto", edit_ref: null });
  check("auto when a marker exists and edit_ref is null → edited", same(outcome(r), { status: 200, steps: 4200, applied: false, reason: "edited", marker: M }), outcome(r));
  r = await steps({ steps: 9000, date: D1, mode: "auto", edit_ref: M });
  check("auto with the matching edit_ref → applied", same(outcome(r), { status: 200, steps: 9000, applied: true, marker: M }), outcome(r));
  check("auto raise keeps the edit's own number (steps_edited_value 4200)", r.json.tracking?.steps_edited_value === 4200, r.json.tracking);
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
  check("GET /api/dashboard/today: an edited day carries its marker and the edit's number", d1.tracking?.steps_edited_at === M && d1.tracking?.steps_edited_value === 4200, d1.tracking);
  check(
    "GET /api/dashboard/today: an unedited day has steps_edited_at: null, steps_edited_value: null",
    d2.tracking && "steps_edited_at" in d2.tracking && d2.tracking.steps_edited_at === null && d2.tracking.steps_edited_value === null,
    d2.tracking
  );

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
  await steps({ steps: 0, date: D4, mode: "manual" });
  r = await call("GET", `/health/days?from=${D4}&to=${D4}`);
  check("GET /api/health/days: a day the member typed 0 shows 0 (not the synced 8000)", r.json.days?.[0]?.steps === 0, r.json.days);

  /* ── B5 ── */
  skip("coach prompt has no steps", "B5 is the AI consent's R2: no tracked steps without consent (src/lib/ai-consent.ts; needs an AI call to observe)");

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
