"use client";
import * as React from "react";
import { Info, Repeat, Smartphone, Workflow } from "lucide-react";
import { GlassCard, IconTile } from "@/components/orza/primitives";
import { Segmented } from "@/components/ui/form";
import { CodeBlock, CopyField, Step, Steps, Ui } from "./HealthUi";
import { METRIC_INFO, HEALTH_METRICS } from "./metrics";

const TOKEN_PLACEHOLDER = "YOUR_SYNC_TOKEN";

function TokenHint({ hasToken }: { hasToken: boolean }) {
  return (
    <p className="text-[12.5px] text-orza-subtle">
      {hasToken ? (
        <>
          Use the token you saved when you created it. Lost it?{" "}
          <a href="#sync-token" className="font-medium text-orza-strong underline-offset-2 hover:underline">
            Replace your token
          </a>
          .
        </>
      ) : (
        <>
          <a href="#sync-token" className="font-medium text-orza-strong underline-offset-2 hover:underline">
            Create your sync token
          </a>{" "}
          first — it goes after “Bearer ”.
        </>
      )}
    </p>
  );
}

/** iPhone: Health Auto Export (REST API automation) or an Apple Shortcut posting daily totals. */
export function IphoneAutoSyncCard({ syncUrl, token, hasToken, today }: { syncUrl: string; token: string | null; hasToken: boolean; today: string }) {
  const [method, setMethod] = React.useState<"hae" | "shortcut">("hae");
  const bearer = `Bearer ${token ?? TOKEN_PLACEHOLDER}`;
  const shortcutBody = JSON.stringify(
    { source: "shortcut", days: [{ date: today, steps: 8234, active_kcal: 412, weight_kg: 72.4 }] },
    null,
    2
  );

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-start gap-3">
        <IconTile tone="violet">
          <Repeat className="h-5 w-5" aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <h3 className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">Automatic daily sync</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-orza-muted">
            A browser can&apos;t read Apple Health, but an app on your iPhone can: it reads your Health data and sends ÖRZA your daily
            totals with your sync token.
          </p>
        </div>
      </div>

      <Segmented
        className="mt-5 self-start"
        size="sm"
        value={method}
        onChange={setMethod}
        options={[
          { value: "hae", label: "Health Auto Export" },
          { value: "shortcut", label: "Apple Shortcuts" },
        ]}
      />

      <div className="mt-5" role="tabpanel" aria-label={method === "hae" ? "Health Auto Export steps" : "Apple Shortcuts steps"}>
        {method === "hae" ? (
          <Steps>
            <Step n={1} title="Install Health Auto Export">
              Get <Ui>Health Auto Export – JSON+CSV</Ui> from the App Store (a third-party app, not made by ÖRZA) and allow it to read
              your Health data.
            </Step>
            <Step n={2} title="Create a REST API automation">
              In the app open <Ui>Automations</Ui> → <Ui>New Automation</Ui> and choose <Ui>REST API</Ui>.
            </Step>
            <Step n={3} title="Paste the URL and header">
              <CopyField label="URL" value={syncUrl} />
              <p>
                Add a header named <Ui>Authorization</Ui> with this value:
              </p>
              <CopyField label="Authorization header value" value={bearer} />
              <TokenHint hasToken={hasToken} />
            </Step>
            <Step n={4} title="Choose what to send">
              Data type <Ui>Health Metrics</Ui> with Step Count, Active Energy, Walking + Running Distance, Sleep Analysis, Resting Heart
              Rate, Heart Rate, Weight &amp; Body Mass and Dietary Water. Format <Ui>JSON</Ui>, summarise data by <Ui>Day</Ui>, date range{" "}
              <Ui>last 7 days</Ui>, sync <Ui>daily</Ui>.
            </Step>
            <Step n={5} title="Test it">
              Run the automation once manually. Your days appear on this page within a minute — each sync updates those days instead of
              adding duplicates.
            </Step>
          </Steps>
        ) : (
          <Steps>
            <Step n={1} title="Create a personal automation">
              Open <Ui>Shortcuts</Ui> → <Ui>Automation</Ui> → <Ui>+</Ui> → <Ui>Time of Day</Ui> (for example 9:30 pm, daily) →{" "}
              <Ui>Run Immediately</Ui> → <Ui>New Blank Automation</Ui>.
            </Step>
            <Step n={2} title="Read today's totals">
              Add <Ui>Find Health Samples</Ui> with Type <Ui>Steps</Ui>, Start Date <Ui>is today</Ui>, Group by <Ui>Day</Ui>. Repeat for
              Active Energy, Weight or Water if you want to send those too.
            </Step>
            <Step n={3} title="Send them to ÖRZA">
              Add <Ui>Get Contents of URL</Ui> with Method <Ui>POST</Ui>, this URL, a header <Ui>Authorization</Ui> and a JSON request body:
              <Ui>source</Ui> = shortcut, and <Ui>days</Ui> = a list with one dictionary holding <Ui>date</Ui> (Current Date formatted as
              yyyy-MM-dd) and your values.
              <CopyField label="URL" value={syncUrl} />
              <CopyField label="Authorization header value" value={bearer} />
              <TokenHint hasToken={hasToken} />
            </Step>
            <Step n={4} title="Match this shape">
              Energy in kcal, weight in kg, water in ml. Leave out anything you don&apos;t track — for sleep, Health Auto Export or the
              Apple Health import is simpler.
              <CodeBlock label="Request body" code={shortcutBody} />
            </Step>
          </Steps>
        )}
      </div>
    </GlassCard>
  );
}

/** Android: Health Connect data via any automation app that can POST JSON. */
export function AndroidSyncCard({ syncUrl, token, hasToken, today }: { syncUrl: string; token: string | null; hasToken: boolean; today: string }) {
  const body = {
    source: "health_connect",
    days: [{ date: today, steps: 8234, active_kcal: 412, distance_km: 5.8, sleep_minutes: 432, resting_hr: 61, avg_hr: 74, weight_kg: 72.4, water_ml: 2250 }],
  };
  const json = JSON.stringify(body, null, 2);
  const curl = [
    `curl -X POST "${syncUrl}" \\`,
    `  -H "Authorization: Bearer ${token ?? TOKEN_PLACEHOLDER}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify({ source: "health_connect", days: [{ date: today, steps: 8234, sleep_minutes: 432 }] })}'`,
  ].join("\n");

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-start gap-3">
        <IconTile tone="energy">
          <Workflow className="h-5 w-5" aria-hidden />
        </IconTile>
        <div className="min-w-0">
          <h3 className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">Health Connect via an automation app</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-orza-muted">
            Browsers can&apos;t read Health Connect. Any automation app on your Android phone that can read Health Connect and send an
            HTTP request can post your daily totals here.
          </p>
        </div>
      </div>

      <Steps className="mt-5">
        <Step n={1} title="Read the day's totals from Health Connect">
          Steps, sleep, heart rate, weight — whatever your phone, watch or scale records.
        </Step>
        <Step n={2} title="POST them to ÖRZA once a day">
          <CopyField label="URL" value={syncUrl} />
          <p>
            Headers: <Ui>Authorization: Bearer &lt;your sync token&gt;</Ui> and <Ui>Content-Type: application/json</Ui>. Up to 400 days and 1
            MB per request, 60 requests an hour.
          </p>
          <TokenHint hasToken={hasToken} />
        </Step>
        <Step n={3} title="Use this JSON">
          Every field except <Ui>date</Ui> is optional. Sending a day again replaces that day&apos;s values from the same source.
          <CodeBlock label="Request body" code={json} />
        </Step>
      </Steps>

      <details className="group mt-5 rounded-orza-sm border border-[rgba(20,20,20,0.10)] bg-white/60">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-orza-sm px-4 py-3 text-[13.5px] font-medium text-orza-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orza-cyan/50">
          Field reference and a curl test
          <span aria-hidden className="text-orza-subtle transition-transform duration-150 group-open:rotate-45">
            +
          </span>
        </summary>
        <div className="space-y-4 px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-[rgba(20,20,20,0.08)] text-orza-subtle">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Field
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Meaning
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Accepted range
                  </th>
                </tr>
              </thead>
              <tbody className="text-orza-muted">
                <tr className="border-b border-[rgba(20,20,20,0.05)]">
                  <td className="py-1.5 pr-3 font-mono text-orza-strong">date</td>
                  <td className="py-1.5 pr-3">Your local day</td>
                  <td className="py-1.5">YYYY-MM-DD</td>
                </tr>
                {HEALTH_METRICS.map((m) => (
                  <tr key={m} className="border-b border-[rgba(20,20,20,0.05)] last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-orza-strong">{m}</td>
                    <td className="py-1.5 pr-3">{METRIC_INFO[m].label}</td>
                    <td className="py-1.5 tabular-nums">
                      {METRIC_INFO[m].min.toLocaleString("en-IN")}–{METRIC_INFO[m].max.toLocaleString("en-IN")} {METRIC_INFO[m].unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12.5px] text-orza-muted">Values outside these ranges are ignored rather than stored.</p>
          <CodeBlock label="curl" code={curl} />
          <p className="text-[12.5px] text-orza-muted">
            A successful call returns <span className="font-mono text-orza-strong">{`{"ok":true,"days_updated":1,"skipped":0}`}</span>.
          </p>
        </div>
      </details>
    </GlassCard>
  );
}

/** Honest "coming soon" card for the native companion app. */
export function MobileAppCard() {
  return (
    <GlassCard variant="subtle" className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60 blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(255,180,84,0.45) 0%, rgba(255,122,106,0.25) 45%, rgba(255,95,162,0) 72%)" }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <IconTile tone="dark" className="!bg-[#141414] !text-white">
          <Smartphone className="h-5 w-5" aria-hidden />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-editorial text-[19px] font-semibold leading-6 text-orza-strong">ÖRZA app for iPhone &amp; Android</h3>
            <span className="rounded-full bg-orza-energy px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">Coming soon</span>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed text-orza-muted">
            Automatic Health sync is coming. With your permission, the ÖRZA app will read Apple Health and Health Connect directly and sync in
            the background through this same secure sync API — no exports or automations needed. Until then, the options on this page keep
            your data flowing.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

/** Short explainer of what ÖRZA stores. */
export function PrivacyNote() {
  return (
    <div className="flex items-start gap-2.5 rounded-orza-sm border border-[rgba(20,20,20,0.08)] bg-white/40 px-4 py-3 text-[12.5px] leading-relaxed text-orza-muted">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-orza-subtle" aria-hidden />
      <span>
        ÖRZA stores one row of daily totals per source — never your raw samples, workouts, locations or clinical records. Synced steps can raise
        your step count for the day, and a synced weight fills days you haven&apos;t logged; your own entries are never overwritten.
      </span>
    </div>
  );
}
