# Production environment setup

How to configure environment variables for a production deploy. Auth is your own flow (no Auth0).

---

## API (`apps/api`)

Set these in your production environment (e.g. host dashboard, `.env` in the API root, or secrets manager). **Do not commit real values.**

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default `4001`). Set if your host uses a different port. |
| `WEB_ORIGIN` | **Yes** | Exact origin of your frontend, e.g. `https://app.yourdomain.com`. Used for CORS and redirects. No trailing slash. |
| `SUPABASE_URL` | **Yes** | Production Supabase project URL. |
| `SUPABASE_ANON_KEY` | **Yes** | Production Supabase anon (public) key. Used by auth middleware to verify tokens. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Production Supabase service role key. Used for server-side DB and storage. |
| `GEMINI_API_KEY` | **Yes** | Google AI (Gemini) API key. Required for image and video generation and brand/email copy. |
| `RESEND_API_KEY` | No | Resend.com API key for transactional emails. If unset, email send is skipped (warning logged). |
| `RESEND_FROM_EMAIL` | No | From address for Resend, e.g. `Blinkify <noreply@yourdomain.com>`. Defaults to a placeholder. |
| `CLEANUP_FAILED_GENERATIONS_INTERVAL_MS` | No | Interval in ms for cleanup job (default from code). Optional. |
| `POLAR_ACCESS_TOKEN` | No | Polar.sh API access token for checkout session creation. Required for billing. |
| `POLAR_SANDBOX` | No | Set to `true` or `1` to use Polar **Sandbox** API (`sandbox-api.polar.sh`). Use this with sandbox product IDs and a token from the Sandbox dashboard. Omit or leave unset for production. |
| `POLAR_PRODUCT_ID_STANDARD` | No | Polar product ID for the Standard plan. Create in Polar dashboard. |
| `POLAR_PRODUCT_ID_PROFESSIONAL` | No | Polar product ID for the Professional plan. Create in Polar dashboard. |
| `POLAR_PRODUCT_ID_AGENCY` | No | Polar product ID for the Agency plan (top tier). Create in Polar dashboard. |

**Polar embed (setup-plan):** Checkout is created via the [Checkout API](https://polar.sh/docs/features/checkout/session) and opened with [Embedded Checkout](https://polar.sh/docs/features/checkout/embed). Set `WEB_ORIGIN` to your frontend origin (e.g. `https://app.blinkify.com`) so `embed_origin` is correct. In Polar dashboard **Catalogue**, open each product (Standard Package, Professional Package, Agency Package), use the ⋮ menu → **Copy Product ID**, and set `POLAR_PRODUCT_ID_STANDARD`, `POLAR_PRODUCT_ID_PROFESSIONAL`, `POLAR_PRODUCT_ID_AGENCY` accordingly.

**Checklist**

1. Create a **production Supabase project** and copy URL, anon key, and service role key.
2. Set `WEB_ORIGIN` to your **production frontend URL** (e.g. `https://app.blinkify.com`). Do not use `*`.
3. Ensure **Row Level Security (RLS)** and policies are correct for production (same schema as dev if you use the same DB, or run migrations on prod).
4. If you use **Resend** for emails (e.g. magic links), add `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` domain.

---

## Web (`apps/web`)

Next.js embeds `NEXT_PUBLIC_*` at **build time**. Set these in the environment where you run `npm run build` (e.g. CI or host’s build step), or in `.env.production` / `.env.local` for local production builds.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | **Yes** | Full URL of the production API, e.g. `https://api.yourdomain.com`. No trailing slash. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Same production Supabase project URL as the API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Same production Supabase anon key. |
| `NEXT_PUBLIC_APP_URL` | No | Public site URL for sitemap, robots, canonicals, and metadata. Use `https://blinkify.ai` for the **marketing site** (indexed). Use `https://app.blinkify.ai` for the **webapp** (noindex, not in sitemap). Defaults to `https://blinkify.ai` if unset. |
| `BLINKIFY_ADMIN_EMAILS` | No | Comma-separated emails for admin-only routes (e.g. `/dashboard/admin`). Server-only; do not use `NEXT_PUBLIC_` so admin list is not exposed to the client. |

**Checklist**

1. **API URL:** Must be reachable from the user’s browser. If the API is behind a path (e.g. `https://yourdomain.com/api`), set `NEXT_PUBLIC_API_URL` to that full base URL.
2. **Supabase:** Use the **same** production project as the API (same URL and anon key). Auth and RLS rely on it.
3. Rebuild the web app after changing any `NEXT_PUBLIC_*` value; they are baked into the client bundle.

---

## Doing it properly (order of operations)

1. **Supabase**
   - Create (or use) a production project.
   - Run your migrations there if you use a separate prod DB.
   - Create the `email-assets` public bucket (see `docs/EMAIL_ASSETS_BUCKET.md`).
   - Copy URL, anon key, service role key.

2. **API**
   - Set all required API variables, especially `WEB_ORIGIN` and Supabase keys.
   - Set `GEMINI_API_KEY` (and optional Resend) for full functionality.
   - Deploy the API and confirm `/health` returns 200.
   - Verify CORS: from the browser on your production domain, a request to the API should not be blocked (origin must match `WEB_ORIGIN`).

3. **Web**
   - Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optional admin emails).
   - Build: `npm run build` (from repo root or `apps/web`).
   - Deploy the built app (e.g. Vercel, Node server, or static export if applicable).

4. **Auth (your flow)**
   - Ensure your auth flow issues Supabase (or compatible) JWTs and that the API’s auth middleware validates them using `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
   - If you use redirects (e.g. after login), point them to your production web origin; the API’s `WEB_ORIGIN` is used when the API redirects.

5. **Optional**
   - Use a single `.env.production` or host-provided env for the web build so you don’t forget a variable.
   - Keep API secrets in a secrets manager and inject them at runtime; avoid committing production values.

---

## Quick reference (copy-paste)

**API (production)**

```bash
PORT=4001
WEB_ORIGIN=https://app.yourdomain.com
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=...
# Optional:
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Blinkify <noreply@yourdomain.com>
# Polar (billing):
POLAR_ACCESS_TOKEN=...
POLAR_PRODUCT_ID_STANDARD=...
POLAR_PRODUCT_ID_PROFESSIONAL=...
POLAR_PRODUCT_ID_ULTRA=...
```

**Web (production build)**

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# Optional: BLINKIFY_ADMIN_EMAILS=admin@yourdomain.com
```

Replace `yourdomain.com` and `xxxx` with your real domain and Supabase project ref.

---

## Hosting and branches (Vercel + GitHub)

- **Vercel:** Connect the GitHub repo; Vercel builds from the branch you set as production.
- **GitHub branches:**
  - **`main`** – Production. Deploy to **blinkify.ai** (marketing site). Set `NEXT_PUBLIC_APP_URL=https://blinkify.ai` so the site is indexed and sitemap/robots point to the marketing domain.
  - **`dev`** – Development and pre-release. Deploy to a Vercel preview URL for testing before merging to `main`. Using **`dev`** as the second branch name is fine; alternatives are `develop` or `staging` if you prefer.
- **Webapp (app.blinkify.ai):** When you add the app subdomain, use a **second Vercel project** (or separate deployment) that builds the same repo with `NEXT_PUBLIC_APP_URL=https://app.blinkify.ai`. That build will serve noindex, no sitemap, and disallow-all robots so the app is not indexed until you are ready.

**Putting /signup and the app on app.blinkify.ai (not indexed):** (1) Use a second Vercel project with production domain app.blinkify.ai. (2) Set `NEXT_PUBLIC_APP_URL=https://app.blinkify.ai` for that project (same API/Supabase vars). The app already uses this to set noindex, Disallow: / in robots.txt, and an empty sitemap. (3) Marketing (blinkify.ai) keeps `NEXT_PUBLIC_APP_URL=https://blinkify.ai`. (4) Link Sign up / Log in from the marketing site to https://app.blinkify.ai/signup and https://app.blinkify.ai/signin; after login users stay on app.blinkify.ai.
