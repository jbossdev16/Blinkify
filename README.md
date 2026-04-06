# Blinkify

AI Image generation B2B SaaS — monorepo.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind, shadcn/ui, Supabase
- **Backend:** Node.js, Express, TypeScript, Supabase, dotenv
- **AI:** Google Gemini (image, video, copy); Resend for email
- **Auth:** Own flow (Supabase Auth–compatible JWTs)
- **Monorepo:** npm workspaces + Turborepo

## Setup

1. **Install (from repo root)**

   ```bash
   npm install
   ```

2. **Environment**

   - `apps/web/.env` — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - `apps/api/.env` — `WEB_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`; optional: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PORT`.
   - **Production:** See `docs/PRODUCTION_ENVIRONMENT.md` for a full checklist and variable list.
   - For **email marketing** (Copy HTML): create a public Supabase bucket `email-assets` — see `docs/EMAIL_ASSETS_BUCKET.md`.

3. **Run**

   ```bash
   npm run dev
   ```

   - Web: http://localhost:3032  
   - API: http://localhost:4001 (health: http://localhost:4001/health)

## Commands (root)

- `npm run dev` — run web + api in dev
- `npm run build` — build all apps
- `npm run lint` — lint all apps

## Verify

From repo root:

- `npm install` — install all workspace dependencies
- `npm run build` — build web + api (both must succeed)
- `npm run lint` — lint web + api

**Known non-blocking:** `next lint` shows a deprecation notice (Next.js 16 will remove it; migrate to ESLint CLI when ready). Web build may show `@next/swc` version mismatch; safe to ignore unless you hit build errors.

## Add shadcn components

From `apps/web`:

```bash
npx shadcn@latest add button
```

Use `components.json` in that folder for defaults.
