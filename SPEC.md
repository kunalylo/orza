# ÖRZA web — build spec (shared contract for all work-streams)

ÖRZA is an India-first AI wellness platform: snap meals, chat/voice-log in English/Hindi/Hinglish, get nutrition insights,
goals, recipes, "compassionate rebalancing" after special meals, reports, household modes.

- **Content / features** come from the ÖRZA wellness app: `.reference/content-src/` (React CRA source: `pages/*.js`,
  `components/landing/*.js`). The marketing copy is the source of truth — keep wording, don't invent new claims.
- **Visual design** comes from the ÖRZA ecosystem site: `.reference/design-src/` (`components/orza/**`, `pages/*.jsx`,
  `index.src.css`). Reuse its look: warm cream canvas, frosted glass cards, Playfair Display headings, Figtree body,
  JetBrains Mono uppercase eyebrows, dark hero with glowing amber→coral→pink orb, cyan focus/accents, pill buttons.
  Read the reference components before building a section — adapt their layout/markup patterns to our content.

## Stack
Next.js 15 App Router (TypeScript, `src/`), React 19, Tailwind 3.4, framer-motion 12, lucide-react, sonner (toasts),
@radix-ui/react-dialog + react-accordion, zod, jose (JWT), bcryptjs, mongodb. Dev server: `npm run dev` → http://localhost:3100.
No other dependencies may be added. No chart library — draw charts with SVG/divs.

## Foundation (already written — import, don't duplicate or rewrite)
| Module | What |
|---|---|
| `tailwind.config.ts`, `src/app/globals.css` | Tokens: `bg-orza-bg-0/1/2/3`, `text-orza-strong/DEFAULT/muted/subtle`, `bg-orza-hero`, `orza-cyan-*`, `orza-violet-*`, `orza-amber/coral/pink/cream`, `rounded-orza-xs..xl`, `shadow-orza-glass/-hover/floating/cta`, `backdrop-blur-orza`, `ease-orza`, `duration-220`, `bg-orza-energy` (gradient), `bg-orza-dot`, `font-editorial`, `font-mono`, `.orza-glass`, `.orza-canvas-grain`, `.orza-hero-grain`, `.orza-energy-text`, `.orza-skeleton`, animations `animate-orza-pulse/float/spin-slow` |
| `src/components/orza/primitives.tsx` | `GlassCard`, `Section`, `Container`, `Eyebrow`, `Heading`, `Lead`, `SectionHeader`, `Tag`, `IconTile`, `BrandMark`, `EnergyRing`, `Bar` |
| `src/components/orza/Reveal.tsx` | `<Reveal delay>` scroll-in animation (client) |
| `src/components/orza/SiteNav.tsx`, `SiteFooter.tsx` | Marketing nav (floating glass pill; transparent over the dark hero on `/`) + footer (posts to `/api/leads`) |
| `src/app/(site)/layout.tsx` | Wraps marketing pages with nav + footer |
| `src/components/ui/button.tsx` | `Button` (variants primary/secondary/ghost/hero/hero-outline/danger/energy; sizes sm/md/lg/icon; `loading`), `ButtonLink`, `buttonVariants()` |
| `src/components/ui/form.tsx` | `Input`, `Textarea`, `Select`, `Label`, `FieldHint`, `Segmented`, `Skeleton` |
| `src/components/ui/dialog.tsx` | `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent({title, description, side})` |
| `src/app/dashboard/layout.tsx` + `src/components/app/AppShell.tsx` | Auth-guarded app shell (sidebar, mobile top bar + bottom tabs). Redirects to `/onboarding` until onboarding is complete |
| `src/components/app/UserProvider.tsx` | `useUser()` → `{ user, setUser, refresh, setCredits }` (client) |
| `src/components/app/ui.tsx` | `PageHeader`, `StatCard`, `MacroRow`, `EmptyState`, `WellnessNote` |
| `src/lib/types.ts` | Data model (User, PublicUser, Profile, Targets, Meal, MealItem, Nutrients, Scan, TrackingDay, ChatSession, ChatMessage, Goal, CompensationPlan, Recipe, CreditTransaction …) |
| `src/lib/db.ts` | `col<T>(name)` → Mongo-like collection (`findOne/find/insertOne/updateOne/findOneAndUpdate/deleteOne/deleteMany/countDocuments`), `newId()`, `nowISO()`, `usingMongo()`. MongoDB when `MONGODB_URI` is set, else `.data/orza-db.json`. Docs use string `id`; never touch `_id`. Only these operators: filters `$gt $gte $lt $lte $ne $in $exists`; updates `$set $inc $push($each,$slice) $unset $setOnInsert` (never put the same path in `$set` and `$setOnInsert`) |
| `src/lib/auth.ts` | `hashPassword`, `verifyPassword`, `startSession(userId)`, `endSession()`, `getSessionUserId()`, `getCurrentUser()`, `requireUser()`, `requireAdmin()`, `toPublicUser(user)`, `isAdminEmail()` |
| `src/lib/http.ts` | `route(handler)` wrapper (maps HttpError/ZodError → `{error, code}`), `json()`, `parseBody(req, zodSchema)`, `HttpError`, `badRequest/unauthorized/forbidden/notFound` |
| `src/lib/ai.ts` | `aiEnabled()`, `aiText({system, messages})`, `aiJSON({system, prompt, shape, imageUrl?})`, `WELLNESS_GUARDRAIL`. Throws HttpError 502/503/504 with friendly messages |
| `src/lib/credits.ts` | `INITIAL_CREDITS=100`, `CREDIT_COSTS` (scan 2, meal_text 1, chat 1, recipe 2, compensation 1, report_insight 1), `spendCredits`, `refundCredits`, `adjustCredits`, `withCredits(userId, action, fn)` (spend → run → refund on throw; 402 `no_credits` when empty) |
| `src/lib/domain/meals.ts` | `sumNutrients`, `cleanItem`, `guessMealType(tz)`, `createMeal({...})`, `listMeals`, `listMealsInRange`, `dayTotals`, `ZERO` |
| `src/lib/domain/tracking.ts` | `getTrackingDay`, `setTracking(userId, date, fields)`, `trackingInRange` |
| `src/lib/domain/targets.ts` | `bmr`, `tdee`, `computeTargets(profile, {goal, weeklyRateKg})`, `DEFAULT_TARGETS` |
| `src/lib/dates.ts` | `DEFAULT_TZ` (Asia/Kolkata), `dateInTz(tz)`, `addDays`, `dateRange`, `isISODate`, `hourInTz`, `weekdayShort` |
| `src/lib/nutrition/index.ts` | **Interface stub** — `FOODS`, `findFood`, `searchFoods`, `nutrientsFor`, `parseMealText` (implemented by the meals stream; everyone else may import these exact signatures) |
| `src/lib/api-client.ts` | Client: `api.get/post/put/patch/del`, `ApiError`, `errorMessage(e)`. 401 → redirects to `/login?next=` |
| `src/lib/site.ts` | `SITE.supportEmail`, `SITE.url` |
| `src/middleware.ts` | Redirects signed-out users away from `/dashboard/**` and `/onboarding` |

**Rules for every API route**: `export const GET = route(async (req) => { const user = await requireUser(); ... return json({...}) })`.
Validate bodies with zod via `parseBody`. Always scope queries by `user_id: user.id` (no IDOR). Never return `password_hash`
(use `toPublicUser`). A user's "today" is `dateInTz(user.profile.timezone)`; accept an optional `date` (validate with `isISODate`).
Every AI feature must work without `OPENAI_API_KEY` via a deterministic fallback (except photo scan → 503 `ai_disabled` with a
friendly "type or speak your meal instead" message). Charge credits only for real AI calls, via `withCredits`.
Route params in Next 15 are async: `export const DELETE = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => { const { id } = await ctx.params; ... })`.

**Rules for UI**: App pages are client components (`"use client"`) that fetch via `api` and show skeletons while loading, friendly
empty states, toasts (`import { toast } from "sonner"`) for errors/success. Mobile-first (works at 375px; bottom tab bar
covers 64px). Use design tokens — no default Tailwind gray/blue palettes, no emojis as icons in app chrome (lucide icons).
Accessible: labels on inputs, `aria-label` on icon buttons, keyboard-usable. After an action that spends credits, call
`setCredits(res.credits)` or `refresh()` from `useUser()`. Wrap AI output with `<WellnessNote />` where it gives advice.

## Routes & API contract

### Marketing (public)
- `/` — `src/app/(site)/page.tsx` composes `src/components/home/*` sections.
- `/pricing`, `/faq`, `/trust`, `/privacy`, `/terms` — `src/app/(site)/<name>/page.tsx`.
- `POST /api/leads {email, source, message?}` → `{ok:true}` (store in `leads`, dedupe by email+source, basic rate limit).

### Auth — `/login` (`src/app/login/page.tsx`, own full-screen layout, `?mode=signup` shows sign-up, `?next=` respected)
- `POST /api/auth/register {name, email, password(≥8)}` → `{user}` + session cookie. 409 if email exists. New user: `credits: INITIAL_CREDITS` (+ transaction "Welcome credits"), `targets: DEFAULT_TARGETS`, `profile: {timezone:"Asia/Kolkata"}`, `preferences: {units:"metric", reminders:true, weekly_report:true, tone:"gentle"}`, `memory: []`, `onboarding_complete:false`.
- `POST /api/auth/login {email, password}` → `{user}`; 401 "Incorrect email or password". Emails are stored lowercase/trimmed.
- `POST /api/auth/logout` → `{ok:true}`; `GET /api/auth/me` → `{user}` | 401.

### Onboarding — `/onboarding` (`src/app/onboarding/page.tsx`, full-screen conversational UI)
- `GET /api/onboarding` → `{step, answers, done, prompt}`; `POST /api/onboarding/step {answer: string | number | string[] , step}` → `{reply, step, options?, input: "text"|"number"|"choice"|"multi"|"none", done, user?}`; `POST /api/onboarding/restart`.
- Scripted steps (deterministic, <2 min): goal → sex → age → height → weight → target weight (lose/gain only) → activity → diet → allergies → region → language → household mode → lifestyle (optional) → summary/confirm → complete (saves `profile`, `targets = computeTargets(profile)`, `onboarding_complete:true`). Free-text parsing for numbers/units (e.g. `5'8"`, `172 cm`, `70kg`, `154 lb`), "skip" allowed on optional steps.

### Today — `/dashboard`
- `GET /api/dashboard/today?date=` → `{date, targets, totals, meals, tracking, remaining:{calories, protein_g}, streak, insight, goal}` (`insight`: deterministic one-liner in ÖRZA's voice based on the numbers).
- `POST /api/track/water {glasses, date?}`, `POST /api/track/steps {steps, date?}`, `POST /api/track/weight {weight_kg, date?}` (also sets `profile.weight_kg`) → `{tracking}`.

### Meals — `/dashboard/meals`, `/dashboard/scan`
- `GET /api/meals?date=` → `{meals, totals}`; `PATCH /api/meals/[id] {meal_type?, items?}` → `{meal}`; `DELETE /api/meals/[id]` → `{ok}`.
- `POST /api/meals/text {text, date?, meal_type?, source?:"text"|"voice"}` → `{meal, ai, unmatched, credits?}` (AI when enabled, else `parseMealText`; 422 if nothing recognised).
- `POST /api/meals/manual {date?, meal_type, food_key, quantity}` or `{date?, meal_type, items}` → `{meal}`.
- `GET /api/foods/search?q=` → `{foods:[{key,name,serving,per_serving,diet,category}]}`.
- `POST /api/meals/scan {image (data URL, jpeg/png/webp, ≤6 MB), note?}` → `{scan, credits}`; `POST /api/meals/scan/[id]/confirm {meal_type?, date?, items?}` → `{meal}`.

### Chat — `/dashboard/chat`
- `GET/POST /api/chat/sessions` → `{sessions}` / `{session}`; `DELETE /api/chat/sessions/[id]`.
- `GET /api/chat/history?session_id=` → `{session, messages}`.
- `POST /api/chat/send {message, session_id?}` → `{session_id, user_message, message, logged_meal?, credits?}`. Detects meal-logging intent ("maine … khaya", "I had/ate …") and logs it; learns durable facts into `user.memory` (max 30).

### Goals & Rebalance — `/dashboard/goals`, `/dashboard/compensation`
- `GET /api/goals/active` → `{goal, weights:[{date, weight_kg}], targets, profile}`; `POST /api/goals/calculate {goal, current_weight_kg, target_weight_kg, weekly_rate_kg?, height_cm?, age?, sex?, activity_level?}` → `{goal, user}`.
- `POST /api/compensation/plan {occasion, description?, extra_calories?, days?(2–5)}` → `{plan, credits?}`; `GET /api/compensation` → `{plans}`; `DELETE /api/compensation/[id]`.

### Recipes & Reports — `/dashboard/recipes`, `/dashboard/reports`
- `GET /api/recipes` → `{recipes}`; `POST /api/recipes/generate {prompt?, max_calories?, cuisine?, diet?}` → `{recipe, credits?}`; `POST /api/recipes/[id]/save {saved}`; `DELETE /api/recipes/[id]`.
- `GET /api/reports/daily?date=` → `{date, totals, targets, meals, tracking, score, highlights, suggestions}`; `GET /api/reports/weekly?end=` → `{days, averages, adherence, best_day, summary}`.

### Account — `/dashboard/credits`, `/dashboard/settings`, `/dashboard/admin`
- `GET /api/credits/balance` → `{credits, costs, ai_enabled}`; `GET /api/credits/transactions` → `{transactions}`.
- `GET/PUT /api/profile` → `{user}`; `PUT /api/settings/preferences`, `PUT /api/settings/targets`, `PUT /api/settings/memory {memory}` → `{user}`.
- `GET /api/account/export` → JSON attachment of all the user's data; `DELETE /api/account {confirm:"DELETE"}` → deletes the user and all their data, ends session.
- Admin (requireAdmin): `GET /api/admin/stats`, `GET /api/admin/users?q=`, `POST /api/admin/credits/[userId]/adjust {amount, reason}`.

## Care module (medicines, reminders, calendar, health sync)

CEO requirements: track food/calories; connect Android/iOS health apps; reminders (push + WhatsApp); calendar connectivity;
photo access (camera + gallery); medicine reminders; **auto alarms from prescriptions**; **every alarm shows the medicine's
photos, not just its name**.

Platform truth (reflect it honestly in UI copy): a web app cannot read Apple HealthKit / Android Health Connect directly or
ring native OS alarms. ÖRZA therefore uses Web Push notifications (image + actions) via a service worker, an in-app
full-screen alarm whenever an ÖRZA tab is open, WhatsApp messages, and a calendar feed (ICS with VALARM) that phone calendars
ring natively. Health data arrives via Apple Health export import, automation apps / Shortcuts posting to ÖRZA's sync API,
CSV import, and (future) the ÖRZA mobile companion app, which will use the same sync API.

### Foundation (already written — use it, don't re-implement)
- Types in `src/lib/types.ts`: `Media`, `Medication`, `Schedule`, `MedForm`, `DoseTiming`, `ExtractedMedicine`, `Prescription`,
  `DoseLog`, `DoseStatus`, `Reminder`, `ReminderKind`, `ReminderChannels`, `PushSubscriptionDoc`, `Dispatch`, `HealthDay`,
  `HealthSource`, `Integrations` (on `User.integrations`).
- Collections: `media`, `medications`, `prescriptions`, `dose_logs`, `reminders`, `push_subscriptions`, `dispatches`, `health_days`.
- `src/lib/dates.ts`: `zonedToUtc(date, "HH:MM", tz)`, `utcToZoned(instant, tz)`, `tzOffsetMinutes`, `daysBetween`, `isHHMM`.
- `src/lib/care/schedule.ts` (unit-tested): `activeOnDate`, `occurrencesOnDate`, `occurrencesBetween`, `nextOccurrence`,
  `normalizeTimes`, `timesForPattern("1-0-1" | "BD" | "TDS" | "HS" …)`, `DEFAULT_SLOT_TIMES`.
- `src/lib/media.ts`: `saveImage(userId, dataUrl, kind)` (JPEG/PNG/WebP ≤1.5 MB), `getOwnedMedia`, `deleteMedia`,
  `mediaUrl(id, signedForSeconds?)`, `verifyMediaSignature`; route `GET /api/media/[id]` (owner or signed URL).
  Client photo prep: `preparePhoto(file)` in `src/components/meals/image.ts` (downscales to 1280px JPEG).
- `src/lib/allergens.ts` for any food suggestion.
- AppShell already links `/dashboard/medicines`, `/dashboard/reminders`, `/dashboard/calendar`, `/dashboard/health` and mounts
  `<AlarmWatcher />` from `src/components/care/AlarmWatcher.tsx` (stub — implement it).
- Env (in `.env.local`): `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`;
  optional `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`. Packages: `web-push`, `fflate`.

### Medicines & prescriptions — `/dashboard/medicines`, `/dashboard/medicines/prescriptions`, `/dashboard/alarm`
- `GET /api/meds` → `{medications}` (active first); `POST /api/meds {name, strength?, form, dose, timing, instructions?, schedule, as_needed?, stock?, for_person?, photos?: dataUrl[] (≤4)}` → `{medication}`;
  `PATCH /api/meds/[id]` (partial) → `{medication}`; `DELETE /api/meds/[id]` → `{ok}` (also deletes its photos and dose logs).
- `POST /api/meds/[id]/photos {image: dataUrl}` → `{medication}`; `DELETE /api/meds/[id]/photos/[mediaId]` → `{medication}`.
  Every medication in a response carries `photo_urls: string[]` (owner URLs via `mediaUrl(id)`).
- `GET /api/meds/today?date=` → `{date, doses: [{medication_id, name, strength, dose, timing, form, photo_urls, scheduled_for, local_time, status: "due"|"upcoming"|"taken"|"skipped"|"snoozed"|"missed", for_person}]}`
  (a dose is "missed" if unacted 60 min after its time). `POST /api/meds/doses {medication_id, scheduled_for, action: "take"|"skip"|"snooze", snooze_minutes?: 5–60}` → `{dose}`
  (upserts `dose_logs` id `${medication_id}:${scheduled_for}`; "take" decrements `stock.count` when set). `GET /api/meds/adherence?days=7|30` → per-day and per-medicine taken/total.
- `POST /api/prescriptions/scan {image: dataUrl}` → `{prescription, credits}` (AI vision via `withCredits(…, "scan")`; stores the photo as media kind
  "prescription"; normalises Indian notation 1-0-1 / BD / TDS / OD / HS / SOS / AC / PC / "x 5 days" via `timesForPattern`; status "review").
  AI disabled → 503 `ai_disabled` and the UI offers manual entry. `GET /api/prescriptions` → `{prescriptions}`;
  `POST /api/prescriptions/[id]/apply {medicines: ExtractedMedicine[] (user-edited), start_date?}` → `{medications}` (creates meds with schedules:
  times, end_date from duration_days; the prescription photo is attached as a fallback photo until the user adds pill photos).
- `/dashboard/alarm?med=<id>&at=<iso>` (opened from notifications too): full-screen alarm with **large medicine photo(s)**, name, strength,
  dose, timing; Take / Snooze 10 min / Skip; lists other doses due at the same time.

### Reminders & notifications — `/dashboard/reminders`
- `GET/POST /api/reminders`, `PATCH/DELETE /api/reminders/[id]` (kinds meal/water/weight/custom; `schedule`; `channels {push, whatsapp, calendar}`).
- `POST /api/push/subscribe {endpoint, keys:{p256dh, auth}}`, `POST /api/push/unsubscribe {endpoint}`, `POST /api/push/test` (uses a medicine photo if one exists).
- `PUT /api/integrations/whatsapp {phone (E.164), opt_in}`, `POST /api/integrations/whatsapp/test`; `PUT /api/integrations/quiet-hours {start, end} | null`;
  `GET /api/integrations` → `{push: {configured, subscriptions}, whatsapp: {configured, phone, opt_in}, calendar: {feed_url | null, external_url_set}, health: {token_preview | null, last_sync | null}, quiet_hours}`.
- `GET|POST /api/cron/dispatch` (auth: `Authorization: Bearer ${CRON_SECRET}` or `?secret=`): for each user, find medication + reminder occurrences in
  (now−10 min, now], skip those already in `dispatches` (idempotent id) or already acted on, respect quiet hours and snoozes (a snoozed dose re-fires at
  `snooze_until`), send Web Push (title, body, `image` = signed URL of the medicine's first photo valid 24 h, `data.url` = alarm page, actions take/snooze)
  and WhatsApp (session text, or the template outside the 24 h window), record the dispatch. Also once-a-day low-stock refill alerts. `vercel.json` runs it every minute.
- `public/sw.js`: `push` → `showNotification` with image/icon/badge/actions/tag/`requireInteraction`; `notificationclick` → action "take"/"snooze" POSTs
  to `/api/meds/doses` (same-origin, credentials) else focuses or opens `data.url`.
- `GET /api/alarms/due` → `{alarms: [{kind: "medication"|"reminder", id, title, body, photo_urls, scheduled_for, url}]}` (due within the last 30 min,
  unacted) — polled every 30 s by `<AlarmWatcher />`, which plays a chime (Web Audio), vibrates and shows the full-screen alarm with photos.

### Calendar — `/dashboard/calendar`
- `GET /api/calendar/feed/[token]` (public; token = `integrations.calendar_token`; serve `text/calendar`): medication doses for the next 30 days
  (each with VALARM, name + dose, and the photo alarm URL) plus reminders with `channels.calendar`. `POST /api/calendar/token` creates/rotates; `DELETE` revokes.
- `PUT /api/calendar/external {url}` (https only — Google "Secret address in iCal format", iCloud public calendar, Outlook ICS); `DELETE` removes;
  `GET /api/calendar/events?from&to` → `{events}` merging external events (server fetch with SSRF guards: https, no private/loopback IPs, 5 s timeout,
  ≤2 MB; RRULE DAILY/WEEKLY with COUNT/UNTIL/BYDAY) + medication doses + reminders + logged meals.
- Page: month + agenda views, "Add to Google / Apple / Outlook" steps with copy button and `webcal://` link, busy-day insight.

### Health sync — `/dashboard/health`
- `POST /api/health/sync` (auth: `Authorization: Bearer <health token>`, no cookies): accepts (a) ÖRZA JSON
  `{source, days:[{date, steps?, active_kcal?, distance_km?, sleep_minutes?, resting_hr?, avg_hr?, weight_kg?, water_ml?}]}` and (b) the "Health Auto Export"
  iOS app REST format `{data:{metrics:[{name, units, data:[{date, qty | Avg | …}]}]}}`; aggregates per day; upserts `health_days`; mirrors steps (max) and
  weight into `tracking`. `POST /api/health/token` → `{token}` (shown once; store sha256 + preview); `DELETE` revokes.
- `POST /api/health/import {source: "apple_health" | "csv", days:[…]}` (session). Apple Health `export.zip` is parsed **in the browser** (fflate unzip +
  streaming scan of `export.xml` for StepCount, ActiveEnergyBurned, DistanceWalkingRunning, SleepAnalysis, RestingHeartRate, HeartRate, BodyMass,
  DietaryWater); only daily aggregates are uploaded. CSV import maps a date column + metric columns.
- `GET /api/health/days?from&to` → `{days}` merged per date. Page: connect cards (iPhone: export import + Health Auto Export / Shortcuts steps with the sync
  URL and token; Android: Health Connect via automation apps posting to the same API, plus CSV; ÖRZA mobile app "coming soon"), charts, last sync.
