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
- On **app.blinkify.ai**, marketing-only routes (/brand-assets, /waitlist) redirect to `blinkify.ai`. Root `/` redirects to `/creative-studio`. Legal pages (/privacy, /terms, /cookies) render on both domains so app pages can link to them without CORS issues.
- On **localhost**, no domain routing — all pages accessible for development.

---

## Vercel projects

### Web deploy (marketing + app) — two valid setups

Vercel’s Next.js step **always** looks for **`web/.next`** next to the deployment root after Turbo builds a package named `web`. It does **not** honor `outputDirectory: apps/web/.next` for that trace step, so you get **`ENOENT … path0/web/.next/routes-manifest.json`** even when the real build is in **`apps/web/.next`**.

**Option A — Root = repository root (default in repo)**  
- **Root Directory:** empty (repo root).  
- Uses **`vercel.json`** at repo root: after `turbo build`, copies **`apps/web/.next` → `web/.next`** so the trace finds `routes-manifest.json`.  
- **`--force`** avoids Turbo remote-cache hits that skip writing `.next`.

**Option B — Root = `apps`**  
- **Root Directory:** `apps`.  
- Uses **`apps/vercel.json`**: `cd .. && npm install` / `turbo build`; **`outputDirectory: web/.next`** resolves to **`apps/web/.next`** (no copy).  
- Clear **Build / Output overrides** in the dashboard so this file wins.

### 1. blinkify.ai (marketing)

- **Root / config:** same as § above (Option A or B).
- **Framework:** Next.js (auto)
- **Domain:** `blinkify.ai`

**Environment Variables (Production):**

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://blinkify.ai` | Used for SEO metadata, sitemap, canonical URLs |
| `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase URL | Session management in middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase anon key | Session management in middleware |
| `SUPABASE_URL` | Production Supabase URL | Waitlist API route (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Waitlist API route (server-side) |
| `RESEND_API_KEY` | Resend API key | Waitlist welcome email (optional) |

**Do NOT set** `API_BACKEND_URL` on the marketing project. It doesn't need API rewrites.

### 2. API (apps/api)

- **Root Directory:** `apps/api`
- **Framework:** Other (no framework)
- **Build/Output:** default; `apps/api/vercel.json` defines the serverless function

**Environment Variables (Production):** see `docs/PRODUCTION_ENVIRONMENT.md`, especially:
- `WEB_ORIGIN` = `https://app.blinkify.ai`
- Supabase and Gemini keys, etc.

Deploy → copy the project URL (e.g. `https://blinkify-api.vercel.app`). This is your **API_BACKEND_URL**.

**Vercel warning:** *"Due to `builds` existing in your configuration file…"* is expected. Safe to ignore.

### 3. app.blinkify.ai (web app)

- **Root / config:** same as marketing (Option A or B).
- **Framework:** Next.js (auto)
- **Domain:** `app.blinkify.ai`

**Environment Variables (Production) — required:**

| Variable | Value | If missing |
|----------|-------|------------|
| `NEXT_PUBLIC_APP_URL` | `https://app.blinkify.ai` | SEO/meta incorrect; middleware domain detection may break |
| `NEXT_PUBLIC_API_URL` | `https://app.blinkify.ai` | Client API calls go to wrong URL |
| **`API_BACKEND_URL`** | **API URL, e.g. `https://blinkify-api.vercel.app`** (no trailing slash) | **Rewrites disabled → signup, login, send-code, workspaces, etc. all 404** |
| `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase URL | Auth fails |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase anon key | Auth fails |

**Important:** `API_BACKEND_URL` is read at **build time**. After adding or changing it, trigger a **Redeploy** so the rewrites are baked in. Without it, `/auth/send-code`, `/auth/verify-code`, `/workspaces`, etc. are not proxied and return **404** (you’ll see “Network error” on signup). For the app project, the build will **fail** on Vercel if `NEXT_PUBLIC_APP_URL` is `https://app.blinkify.ai` but `API_BACKEND_URL` is missing.

**Domain setup:** Vercel → Settings → Domains → Add `app.blinkify.ai`. Copy the CNAME target. In GoDaddy DNS, add CNAME `app` → Vercel CNAME target.

---

## Summary

| Project | Root | Domain | Key env |
|---------|------|--------|---------|
| Marketing | repo root *or* `apps` | **blinkify.ai** | `NEXT_PUBLIC_APP_URL=https://blinkify.ai` |
| API | `apps/api` | **blinkify-api.vercel.app** | `WEB_ORIGIN=https://app.blinkify.ai` |
| App | repo root *or* `apps` | **app.blinkify.ai** | `NEXT_PUBLIC_APP_URL=https://app.blinkify.ai`, `API_BACKEND_URL=https://blinkify-api.vercel.app` |

The app uses Next.js rewrites to proxy `/auth/*`, `/workspaces/*`, `/checkout/*`, etc. to the API. Middleware handles cross-domain redirects so users always land on the correct domain.
