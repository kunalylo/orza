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
