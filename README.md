# ÖRZA web

ÖRZA is an India-first AI wellness platform. People snap meals, chat or voice-log in English, Hindi or Hinglish, get nutrition insights, set goals, get recipes and gentle "rebalance" plans after special meals, and read daily and weekly reports. The **Care** module adds medicines with photos, alarms created from a scanned prescription, reminders (Web Push, WhatsApp, an in-app alarm), a calendar feed, and health data sync.

`SPEC.md` is the shared build contract. It covers the architecture, design system and every API route.

## Stack

Next.js 15 (App Router, TypeScript, `src/`) · React 19 · Tailwind 3.4 · framer-motion · lucide-react · sonner · zod · jose (JWT) · bcryptjs · MongoDB · web-push · fflate.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3100
```

With no `MONGODB_URI`, data goes to `.data/orza-db.json`. That file store is for local development only. With no `OPENAI_API_KEY`, meal text logging, chat, recipes and rebalance plans use ÖRZA's built-in Indian food database and rule-based coach instead. Photo scanning (meals and prescriptions) needs a key.

| Command | What |
|---|---|
| `npm run dev` | Dev server on port 3100 |
| `npm run build` / `npm start` | Production build / server (port 3100) |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/make-admin.mjs <email>` | Grant admin access to an existing account as a sub-admin (`--super`, `--sub`, `--revoke`, `--list`) |

## Configuration

Every variable is documented in `.env.example`. For production:

- **`MONGODB_URI`, `MONGODB_DB`**: required. Indexes are created on first connect.
- **`JWT_SECRET`**: required, 32 or more random characters. It signs session cookies. Sessions are also recorded server-side, so signing out revokes them.
- **`NEXT_PUBLIC_SITE_URL`**: the public `https://` origin. Canonical links, Open Graph URLs, calendar feed links and notification links are built from it. If it is unset, page metadata uses the Vercel deployment host on Vercel. On any other host it falls back to `http://localhost:3100` and logs a warning.
- **`OPENAI_API_KEY`**, plus optional `OPENAI_MODEL` and `OPENAI_VISION_MODEL` (both default to `gpt-4o-mini`). Reasoning models such as the o-series and gpt-5 work too, and `OPENAI_REASONING_EFFORT` tunes them. The vision model must accept images: it never falls back to the text model.
- **Reminders**: `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are for Web Push (`npx web-push generate-vapid-keys`). `CRON_SECRET` protects `/api/cron/dispatch`. The WhatsApp Cloud API variables are optional.

### Admin console and roles

Admin accounts are **staff-only**. Signing in with one opens the admin console at `/dashboard/admin`. The console has its own sidebar with Overview, Members, Credit requests, Team and My account. It never shows the member app: no Today page, meals, Care, onboarding or credits pill. If an admin opens a member page, they are sent back to the console. Member numbers and lists leave admin accounts out.

There are two roles:

| Role | Can |
|---|---|
| **Super admin** (`admin_role: "super"`) | Everything below, plus the **Team** page: add sub-admins, reset a sub-admin's password, remove a sub-admin |
| **Sub-admin** (`admin_role: "sub"`, or no role) | Overview stats, Members (search, adjust credits), Credit requests, My account (change password, sign out) |

**Adding a sub-admin.** On Team, choose **Add sub-admin** and enter a name and work email. You can let ÖRZA generate a strong 14-character password or set one yourself. This creates a new, separate staff account; the email must not already belong to an ÖRZA account. The password is shown once. Share it privately and ask the sub-admin to change it under **My account** after they first sign in. **Reset password** gives the sub-admin a new one-time password and signs them out on every device. **Remove** deletes their staff account. Super admins can't be removed, demoted or reset from the panel, and nobody can remove their own account there.

Admin rights come only from `is_admin: true` on a user record, set by the Team page or the script below. They are never granted from an email address, because ÖRZA doesn't verify that people own the address they sign up with. Use the script to set up the first super admin, or to change roles:

```bash
node scripts/make-admin.mjs person@example.com           # grant (sub-admin)
node scripts/make-admin.mjs person@example.com --super   # grant as super admin
node scripts/make-admin.mjs person@example.com --sub     # make a super admin a sub-admin
node scripts/make-admin.mjs person@example.com --revoke  # remove admin access
node scripts/make-admin.mjs --list                       # list admins and their roles
```

A plain grant never demotes an existing super admin; pass `--sub` to do that. Granting admin to an existing account turns it into a staff account, so its member features disappear. Use a separate work email for staff. The script reads `MONGODB_URI` and `MONGODB_DB` from the environment, `.env.local` or `.env`. Without them it edits the local `.data/orza-db.json`; stop the dev server first so the server doesn't overwrite the change.

## Deployment notes

- **Reminder dispatcher**: `vercel.json` runs `GET /api/cron/dispatch` every minute. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Per-minute crons need Vercel Pro; on Hobby or other hosts, call the same URL every minute with that header or with `?secret=$CRON_SECRET` (for example from cron-job.org).
- **Public URLs**: set `NEXT_PUBLIC_SITE_URL` in production. Without it, calendar feed links and alarm links fall back to the request origin, and WhatsApp messages carry no images or links.
- **Cross-site guard**: `route()` in `src/lib/http.ts` refuses state-changing API requests (anything but GET/HEAD/OPTIONS) that come from another site (`Sec-Fetch-Site` / `Origin`) or aren't JSON (`415`; a bodyless DELETE may omit the Content-Type). Scripts calling the API must send `Content-Type: application/json`. Token-authenticated routes opt out with `route(handler, { tokenAuth: true })`: `POST /api/health/sync` (Bearer sync token) and `/api/cron/dispatch` (secret). The public calendar feed is GET-only.
- **Rate limits**: sign-in, sign-up, the leads form and health sync use in-memory counters (`src/lib/rate-limit.ts`), so on serverless hosting each warm instance keeps its own window; move them to a shared store (Redis/Upstash, or a Mongo collection with a TTL index) if the limits must hold across instances. Behind your own proxies, set `TRUSTED_PROXY_HOPS`. AI spend limits (`src/lib/ai-guard.ts`: per-user requests per minute, concurrency, and a daily allowance of refunded unusable answers) are counted from `credit_transactions`, so they already hold across instances.
- **Request size**: API routes read bodies through a byte cap (`src/lib/http.ts`). The cap is 16 KB for public forms, 1 MB by default, and 12 MB for photo uploads and imports; larger bodies get `413`. Behind a reverse proxy, set a matching limit there too, for example nginx `client_max_body_size 12m`.
- **Web Push on iPhone** only works after the site is added to the Home Screen (iOS 16.4+). `public/manifest.webmanifest` and `public/sw.js` provide the install and push support.
- **Security headers** (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) are set in `next.config.mjs`.

## Project layout

```
src/app/(site)/        marketing pages (/, /pricing, /faq, /trust, /privacy, /terms)
src/app/login, onboarding
src/app/dashboard/     the signed-in app (Today, Meals, Snap & Know, Ask ÖRZA, Care, Goals, Recipes, Reports, Account); admin/ is the staff console
src/app/api/           route handlers: route() + requireUser() + zod parseBody(), always scoped by user_id
src/components/        orza/ (design primitives), ui/ (Button, form, Dialog), app/ (member shell), admin/ (admin shell + console), one folder per feature
src/lib/               auth, db, http, ai, credits, dates, allergens, domain/, care/, nutrition/
scripts/               operational scripts (make-admin)
```
