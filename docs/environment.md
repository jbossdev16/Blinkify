# Environment variables

Copy the example files, then fill in **your** values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Do not commit real values. Placeholders only belong in git.

---

## API (`apps/api/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Listen port. Default `4001`. |
| `WEB_ORIGIN` | **Yes** | Frontend origin for CORS and redirects. No trailing slash. Local: `http://localhost:3032`. Production: `https://app.yourdomain.com`. Do not use `*`. |
| `SUPABASE_URL` | **Yes** | Supabase project URL. |
| `SUPABASE_ANON_KEY` | **Yes** | Supabase anon key. Auth middleware uses it to verify user JWTs. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Service role key. Server-side DB and Storage only. |
| `GEMINI_API_KEY` | **Yes** | Google AI key for image, video, brand, and campaign generation. |
| `ANTHROPIC_API_KEY` | No | Anthropic key for marketing email HTML. |
| `PROJECT_ID` / `VERTEX_PROJECT_ID` | No | GCP project if you use Vertex instead of a Gemini API key. |
| `LOCATION` / `VERTEX_LOCATION` | No | Vertex location. Default `global`. |
| `RESEND_API_KEY` | No | Resend key for transactional mail. If unset, sends are skipped and a warning is logged. |
| `RESEND_FROM_EMAIL` | No | From header, e.g. `Blinkify <noreply@yourdomain.com>`. |
| `PUBLIC_SITE_URL` | No | Public site URL used in some emails. Default `https://blinkify.ai`. |
| `CLEANUP_FAILED_GENERATIONS_INTERVAL_MS` | No | Interval for the failed-generation cleanup job. |
| `CLEANUP_UNSAVED_GENERATIONS_INTERVAL_MS` | No | Interval for the unsaved-generation cleanup job. |
| `POLAR_ACCESS_TOKEN` | No | Polar API token. Required for checkout. |
| `POLAR_SANDBOX` | No | `true` or `1` to use `sandbox-api.polar.sh`. |
| `POLAR_PRODUCT_ID_STANDARD` | No | Polar product id — Standard monthly. |
| `POLAR_PRODUCT_ID_STANDARD_ANNUAL` | No | Standard annual. |
| `POLAR_PRODUCT_ID_PROFESSIONAL` | No | Professional monthly. |
| `POLAR_PRODUCT_ID_PROFESSIONAL_ANNUAL` | No | Professional annual. |
| `POLAR_PRODUCT_ID_AGENCY` | No | Agency monthly. |
| `POLAR_PRODUCT_ID_AGENCY_ANNUAL` | No | Agency annual. |
| `POLAR_WEBHOOK_SECRET` | Yes if billing | Polar webhook signing secret. Verifies `POST /webhooks/polar`. |

Webhook URL: `https://<your-api-host>/webhooks/polar`. Subscribe to `subscription.active`, `subscription.updated`, and `subscription.revoked`.

---

## Web (`apps/web/.env.local`)

`NEXT_PUBLIC_*` is inlined at **build** time. Restart / rebuild after changing any of them.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Yes** | Browser-facing API base. Local: `http://localhost:4001`. Production can be the app origin if you proxy via `API_BACKEND_URL`. |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Same Supabase project as the API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Same anon key as the API. |
| `NEXT_PUBLIC_APP_URL` | No | Public origin for metadata, sitemap, robots. Marketing site vs app hostname behavior uses this. |
| `API_BACKEND_URL` | Production app | Express API origin. Next.js rewrites `/auth`, `/workspaces`, `/checkout`, etc. to this host. Build-time. |
| `BLINKIFY_ADMIN_EMAILS` | No | Comma-separated emails allowed to open `/admin`. Server-only — do not use `NEXT_PUBLIC_`. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | No | Only if you use the Next.js `/api/waitlist` route. Prefer the Express waitlist endpoint. |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | No | Waitlist welcome email from the Next.js route. |

---

## Copy-paste skeletons

**API**

```bash
PORT=4001
WEB_ORIGIN=https://app.yourdomain.com
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
# RESEND_API_KEY=
# RESEND_FROM_EMAIL=Blinkify <noreply@yourdomain.com>
# POLAR_ACCESS_TOKEN=
# POLAR_WEBHOOK_SECRET=
# POLAR_PRODUCT_ID_STANDARD=
# POLAR_PRODUCT_ID_PROFESSIONAL=
# POLAR_PRODUCT_ID_AGENCY=
```

**Web**

```bash
NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_API_URL=https://app.yourdomain.com
API_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# BLINKIFY_ADMIN_EMAILS=you@yourdomain.com
```
