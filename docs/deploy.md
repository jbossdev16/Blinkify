# Deploy

The hosted product splits traffic by hostname. You can run the same split, or serve everything from one origin in development.

## Hostname split (optional)

`apps/web/src/middleware.ts` looks at `Host`:

| Host | Role | Routes |
| --- | --- | --- |
| Marketing origin | Landing, legal, waitlist | `/`, `/privacy`, `/terms`, `/cookies`, `/brand-assets`, `/waitlist` |
| App origin | Auth and product | `/signin`, `/signup`, `/creative-studio`, `/brand`, `/billing`, `/projects/*`, `/dashboard/*`, … |
| API origin | Express | `/health`, `/auth/*`, `/workspaces/*`, `/checkout/*`, `/webhooks/polar`, … |

On **localhost**, the split is off — every page is reachable.

If you use two web origins:

- Marketing build: `NEXT_PUBLIC_APP_URL=https://yourdomain.com` (indexed).
- App build: `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com` (noindex, empty sitemap).
- Link Sign up / Log in on the marketing site to the app origin.

## Vercel

Two (or three) Vercel projects can deploy from this one repo.

### Web (`apps/web`)

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Include files outside Root Directory | On (monorepo install) |
| Framework | Next.js (`apps/web/vercel.json`) |

**Marketing project env**

- `NEXT_PUBLIC_APP_URL` — marketing origin
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not set `API_BACKEND_URL` on a marketing-only project.

**App project env**

- `NEXT_PUBLIC_APP_URL` — app origin
- `NEXT_PUBLIC_API_URL` — usually the app origin (browser calls same host; Next rewrites to the API)
- `API_BACKEND_URL` — Express deployment URL (**build time** — redeploy after changing it)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`apps/web/scripts/check-api-backend-env.js` fails the app build on Vercel if `API_BACKEND_URL` is missing.

### API (`apps/api`)

| Setting | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Framework | Other — `apps/api/vercel.json` maps all routes to `src/index.ts` |
| Max duration | 300s (generation can run long) |

Set every required API variable from [environment.md](environment.md). `WEB_ORIGIN` must be the **app** origin (CORS).

## Other hosts

Anything that can run Node 20+ works:

1. `bun install && bun run build` (or npm).
2. Web: `apps/web` — `next start` after build, or your platform’s Next adapter.
3. API: `apps/api` — `node dist/index.js` after `tsc`.
4. Put secrets in the platform’s secret manager, not in the image or the git repo.

## Production checklist

- [ ] Own Supabase project; migrations applied; RLS on
- [ ] `WEB_ORIGIN` matches the real app origin
- [ ] `GEMINI_API_KEY` set on the API
- [ ] Web rebuilt after `NEXT_PUBLIC_*` changes
- [ ] `/health` returns 200
- [ ] Browser calls to the API are not blocked by CORS
- [ ] Polar webhook (if you bill) verifies with `POLAR_WEBHOOK_SECRET`
- [ ] Service role key exists only on the server
