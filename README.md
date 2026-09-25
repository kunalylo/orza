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
| `node scripts/make-admin.mjs <email>` | Grant admin access to an existing account (`--revoke`, `--list`) |

## Configuration

Every variable is documented in `.env.example`. For production:

- **`MONGODB_URI`, `MONGODB_DB`**: required. Indexes are created on first connect.
- **`JWT_SECRET`**: required, 32 or more random characters. It signs session cookies. Sessions are also recorded server-side, so signing out revokes them.
- **`NEXT_PUBLIC_SITE_URL`**: the public `https://` origin. Canonical links, Open Graph URLs, calendar feed links and notification links are built from it. If it is unset, page metadata uses the Vercel deployment host on Vercel. On any other host it falls back to `http://localhost:3100` and logs a warning.
- **`OPENAI_API_KEY`**, plus optional `OPENAI_MODEL` and `OPENAI_VISION_MODEL` (both default to `gpt-4o-mini`). Reasoning models such as the o-series and gpt-5 work too, and `OPENAI_REASONING_EFFORT` tunes them. The vision model must accept images: it never falls back to the text model.
- **Reminders**: `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are for Web Push (`npx web-push generate-vapid-keys`). `CRON_SECRET` protects `/api/cron/dispatch`. The WhatsApp Cloud API variables are optional.

### Admin access

Admin rights come only from `is_admin: true` on a user record. They are never granted from an email address, because ÖRZA doesn't verify that people own the address they sign up with. To grant admin to someone who already has an account:

```bash
node scripts/make-admin.mjs person@example.com           # grant
node scripts/make-admin.mjs person@example.com --revoke  # remove
node scripts/make-admin.mjs --list                       # list admins
```

The script reads `MONGODB_URI` and `MONGODB_DB` from the environment, `.env.local` or `.env`. Without them it edits the local `.data/orza-db.json`; stop the dev server first so the server doesn't overwrite the change.

## Deployment notes

- **Reminder dispatcher**: `vercel.json` runs `GET /api/cron/dispatch` every minute. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. On other hosts, call the same URL every minute with that header.
- **Request size**: API routes read bodies through a byte cap (`src/lib/http.ts`). The cap is 16 KB for public forms, 1 MB by default, and 12 MB for photo uploads and imports; larger bodies get `413`. Behind a reverse proxy, set a matching limit there too, for example nginx `client_max_body_size 12m`.
- **Web Push on iPhone** only works after the site is added to the Home Screen (iOS 16.4+). `public/manifest.webmanifest` and `public/sw.js` provide the install and push support.
- **Security headers** (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) are set in `next.config.mjs`.

## Project layout

```
src/app/(site)/        marketing pages (/, /pricing, /faq, /trust, /privacy, /terms)
src/app/login, onboarding
src/app/dashboard/     the signed-in app (Today, Meals, Snap & Know, Ask ÖRZA, Care, Goals, Recipes, Reports, Account)
src/app/api/           route handlers: route() + requireUser() + zod parseBody(), always scoped by user_id
src/components/        orza/ (design primitives), ui/ (Button, form, Dialog), app/ (shell), one folder per feature
src/lib/               auth, db, http, ai, credits, dates, allergens, domain/, care/, nutrition/
scripts/               operational scripts (make-admin)
```
