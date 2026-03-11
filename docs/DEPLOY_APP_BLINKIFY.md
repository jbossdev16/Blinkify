# Deploy app.blinkify.ai (web + API on one domain)

Use **blinkify.ai** for marketing and **app.blinkify.ai** for the app (login, signup, dashboard). You can run all three on Vercel: marketing, app, and API.

---

## Option A: All three on Vercel

### 1. Vercel project 1 – blinkify.ai (marketing)

Already done. Same repo, domain **blinkify.ai**, root `apps/web` (or as currently set). Env: `NEXT_PUBLIC_APP_URL=https://blinkify.ai`, etc.

### 2. Vercel project 2 – API (apps/api)

- **Vercel** → Add New → **Project** → import the same Git repo.
- **Root Directory:** `apps/api`.
- **Framework:** Other (no framework).
- **Build Command:** `npm run build` (or `npx tsc`).
- **Output Directory:** leave empty (this project is a serverless API, not static).
- **Install Command:** `npm install` (from repo root you may need to run from monorepo root; if so, set Root to repo root and override build to `cd apps/api && npm install && npm run build` — or use a root that has package.json for the API).

For a monorepo, the API project is usually deployed with **Root Directory** = `apps/api`. If `apps/api` has its own `package.json`, Vercel will run `npm install` and `npm run build` in that directory. Confirm that `apps/api/package.json` has the right scripts.

- **No custom Output Directory.** The API is exposed as a serverless function: the repo exports the Express app from `apps/api/src/index.ts` (see code: `export default app` when running on Vercel).
- Add **Environment Variables** (Production) from `docs/PRODUCTION_ENVIRONMENT.md` (API section), especially:
  - `WEB_ORIGIN` = `https://app.blinkify.ai`
  - Supabase and Gemini keys, etc.
- Deploy. Copy the project URL, e.g. `https://blinkify-api-xxx.vercel.app`. This is your **API_BACKEND_URL** for the app project.

**Note:** On Vercel the API runs as serverless (no long-running process). The scheduled cleanups (failed generations, unsaved generations) do **not** run automatically. To run them on a schedule, add [Vercel Cron](https://vercel.com/docs/cron-jobs) later that call your cleanup endpoints, or leave cleanup disabled (set `CLEANUP_FAILED_GENERATIONS_INTERVAL_MS=0` and `CLEANUP_UNSAVED_GENERATIONS_INTERVAL_MS=0` if you prefer).

### 3. Vercel project 3 – app.blinkify.ai (apps/web)

- **Vercel** → Add New → **Project** → import the same Git repo.
- **Root Directory:** `apps/web`.
- **Framework:** Next.js (auto).
- **Build / Output:** leave default.

**Environment Variables** (Production):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://app.blinkify.ai` |
| `NEXT_PUBLIC_API_URL` | `https://app.blinkify.ai` |
| `API_BACKEND_URL` | API project URL from step 2, e.g. `https://blinkify-api-xxx.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase anon key |

**Domain:** Settings → Domains → Add → `app.blinkify.ai`. Copy the CNAME target.

**GoDaddy DNS:** Add CNAME **Name** `app`, **Value** = the Vercel CNAME target. Save and wait until the domain shows as Valid in Vercel.

Redeploy the app project after saving env vars.

---

## Option B: API on Railway/Render/Fly (two Vercel projects)

If you prefer a long-running API server (scheduled cleanups run in-process):

- Deploy **apps/api** on Railway, Render, or Fly.io (Root `apps/api`, build/start as in `PRODUCTION_ENVIRONMENT.md`). Set `WEB_ORIGIN=https://app.blinkify.ai`.
- Use that deployment URL as **API_BACKEND_URL** in the app.blinkify.ai Vercel project (step 3 above). Everything else (app project, domain, DNS) is the same.

---

## Summary (all three on Vercel)

| Project | Vercel | Root | Domain / URL |
|--------|--------|------|----------------|
| Marketing | Project 1 | `apps/web` | **blinkify.ai** |
| API | Project 2 | `apps/api` | **xxx.vercel.app** (use as `API_BACKEND_URL`) |
| App | Project 3 | `apps/web` | **app.blinkify.ai** (proxies API via `API_BACKEND_URL`) |

The app at app.blinkify.ai uses Next.js rewrites so that `/health`, `/auth/*`, `/checkout/*`, `/workspaces/*`, etc. are proxied to the API project URL. Only **blinkify.ai** and **app.blinkify.ai** need to be set in DNS; the API stays on the Vercel project URL.
