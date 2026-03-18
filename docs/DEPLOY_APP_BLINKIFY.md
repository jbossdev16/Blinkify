# Deploy Blinkify (marketing + app + API)

Both **blinkify.ai** and **app.blinkify.ai** deploy from the same `apps/web` codebase. Middleware in `src/middleware.ts` enforces route separation by hostname.

---

## Domain / Route separation

| Domain | Purpose | Routes served |
|--------|---------|---------------|
| **blinkify.ai** | Marketing & landing page | `/` (landing), `/privacy`, `/terms`, `/cookies`, `/brand-assets`, `/waitlist`, `/api/waitlist` |
| **app.blinkify.ai** | Web app (auth, dashboard, studio) | `/signin`, `/signup`, `/reset-password`, `/setup-plan`, `/creative-studio`, `/brand`, `/asset-collection`, `/billing`, `/settings`, `/studio`, `/admin`, `/projects/*`, `/dashboard/*` |
| **blinkify-api.vercel.app** | Express API | `/health`, `/auth/*`, `/workspaces/*`, `/checkout/*`, `/admin/*`, `/invitations/*`, etc. |

**How it works:** `src/middleware.ts` checks the `Host` header:
- On **blinkify.ai**, app routes (signin, signup, creative-studio, etc.) redirect to `app.blinkify.ai`.
- On **app.blinkify.ai**, marketing-only routes (/brand-assets, /waitlist) redirect to **blinkify.ai**. Root `/` redirects to `/creative-studio`. Legal pages render on both domains.
- On **localhost**, no domain routing — all pages accessible for development.

---

## Vercel — web projects (marketing + app)

**Root Directory:** **`apps/web`** (both blinkify-web and blinkify-app).

**Why not repo root + Turbo copy:** Vercel then looks for `next` under the wrong tree → `ENOENT … server.runtime.prod.js`. Deploying from **`apps/web`** matches Next’s layout (`.next` + `node_modules/next`).

**Settings:**

| Setting | Value |
|--------|--------|
| Root Directory | `apps/web` |
| Include source files outside of Root Directory | **On** (needed so `installCommand` can `cd ../..` and run root `npm install`) |
| Install / Build / Output | **Empty** — use `apps/web/vercel.json` |

**`apps/web/vercel.json`:** installs from monorepo root (`cd ../.. && npm install`), symlinks `next` into `apps/web/node_modules` (workspace hoists `next` to root; Vercel’s tracer expects it next to the app), then `npm run build`.

### 1. blinkify.ai (marketing)

- **Domain:** `blinkify.ai`

**Environment Variables (Production):**

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://blinkify.ai` | SEO, sitemap, canonical |
| `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase URL | Middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key | Middleware |
| `SUPABASE_URL` | Production Supabase URL | Waitlist API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role | Waitlist API |
| `RESEND_API_KEY` | Resend key | Waitlist email (optional) |

**Do NOT set** `API_BACKEND_URL` on the marketing project.

### 2. API (apps/api)

- **Root Directory:** `apps/api`
- **Framework:** Other; `apps/api/vercel.json` defines the serverless function

**Environment:** see `docs/PRODUCTION_ENVIRONMENT.md` — `WEB_ORIGIN` = `https://app.blinkify.ai`, etc.

Deploy URL → **API_BACKEND_URL** for the app project.

### 3. app.blinkify.ai (web app)

- **Domain:** `app.blinkify.ai`

**Environment Variables (Production) — required:**

| Variable | Value | If missing |
|----------|-------|------------|
| `NEXT_PUBLIC_APP_URL` | `https://app.blinkify.ai` | Middleware / meta |
| `NEXT_PUBLIC_API_URL` | `https://app.blinkify.ai` | Client API base |
| **`API_BACKEND_URL`** | e.g. `https://blinkify-api.vercel.app` | Rewrites 404 without it |
| `NEXT_PUBLIC_SUPABASE_URL` | Production URL | Auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon | Auth |

`API_BACKEND_URL` is **build time** — redeploy after changing it.

---

## Summary

| Project | Root | Domain | Key env |
|---------|------|--------|---------|
| Marketing | **apps/web** | **blinkify.ai** | `NEXT_PUBLIC_APP_URL=https://blinkify.ai` |
| API | `apps/api` | **blinkify-api.vercel.app** | `WEB_ORIGIN=https://app.blinkify.ai` |
| App | **apps/web** | **app.blinkify.ai** | `NEXT_PUBLIC_APP_URL=…`, `API_BACKEND_URL=…` |

The app uses Next.js rewrites to proxy `/auth/*`, `/workspaces/*`, etc. to the API.
