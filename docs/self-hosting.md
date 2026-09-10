# Self-hosting Blinkify

Order of operations if you are standing this up for the first time.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com/).
2. Run every file in `supabase/migrations/` in filename order (SQL editor), or from the repo root:

   ```bash
   bunx supabase db push
   ```

3. Copy **Project URL**, **anon key**, and **service role key** from Project Settings → API.
4. Auth → URL Configuration:
   - **Site URL** — your app origin (`http://localhost:3032` for local, `https://app.yourdomain.com` in production)
   - **Redirect URLs** — include `/creative-studio` and any other `redirectTo` paths you use
5. Optional: enable Google — [google-signin.md](google-signin.md).

Storage buckets are created by migrations (`project-assets`, `generated-images`, `generated-videos`). The API creates `email-assets` (public) on startup if it is missing. Details: [storage.md](storage.md).

Confirm RLS is enabled on public tables. The migrations turn it on.

## 2. API

1. `cp apps/api/.env.example apps/api/.env`
2. Set `WEB_ORIGIN`, the three Supabase vars, and `GEMINI_API_KEY`.
3. Start it (`bun run dev` from the repo root, or `bun run dev` inside `apps/api`).
4. `GET /health` must return 200.

In production, inject the same variables from your host’s secret store. The API does not read a `.env` file on Vercel (`VERCEL` is set).

## 3. Web

1. `cp apps/web/.env.example apps/web/.env.local`
2. Point `NEXT_PUBLIC_API_URL` at the API (local: `http://localhost:4001`).
3. Use the **same** Supabase URL and anon key as the API.
4. For a production app deploy that proxies API paths, set `API_BACKEND_URL` to the Express origin and usually set `NEXT_PUBLIC_API_URL` to the app origin.

Rebuild after any `NEXT_PUBLIC_*` or `API_BACKEND_URL` change.

## 4. Auth

Signup / signin go through Supabase Auth. The API reads the JWT (`Authorization: Bearer …`) and upserts an internal `users` row plus a default workspace.

If Google login fails, the problem is almost always redirect URLs in Google Cloud or Supabase — not application code.

## 5. Billing (optional)

Blinkify talks to [Polar](https://polar.sh/) for checkout and subscription webhooks.

1. Create products for Standard / Professional / Agency (monthly and annual).
2. Set the six `POLAR_PRODUCT_ID_*` variables and `POLAR_ACCESS_TOKEN`.
3. Add a webhook endpoint to `/webhooks/polar` and set `POLAR_WEBHOOK_SECRET`.
4. Use `POLAR_SANDBOX=true` with sandbox product ids while you test.

Without Polar, generation and the studio still work; paid checkout will not.

## 6. Email (optional)

Set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL` for password reset, invites, and waitlist mail. If unset, those sends are skipped.

## Local ports

These ports are fixed in this repo:

| Service | Port |
| --- | --- |
| Next.js | `3032` |
| Express | `4001` |

Do not change them unless you also change CORS, env examples, and the Cursor rule in `.cursor/rules/dev-server-port.mdc`.
