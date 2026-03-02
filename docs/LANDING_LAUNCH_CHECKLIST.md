# Landing page launch checklist

Launch **only** the marketing site at **blinkify.ai**. The webapp will later live at **app.blinkify.ai** (separate deployment).

---

## 1. Hosting: Vercel (not Expo)

- **Vercel** – Use this. It’s the standard for Next.js. Your app is in `apps/web` (Next.js); Vercel will build and serve it, and you get previews, envs, and a simple way to attach blinkify.ai.
- **Expo** – For React Native (mobile apps). Not used for hosting this landing page. Ignore Expo for this launch.

**Conclusion:** Deploy the monorepo to Vercel, with the **root directory** set to the repo root and the **build command** targeting `apps/web` (see below).

---

## 2. GitHub: two branches, two environments

| Branch | Role        | Deploys to                    |
|--------|-------------|-------------------------------|
| `main` | Production  | **blinkify.ai** (marketing)   |
| `dev`  | Development | Vercel preview URL (e.g. `*.vercel.app`) |

**Setup**

1. **Default branch:** Keep `main` as the default (production).
2. **Create `dev`:**
   ```bash
   git checkout -b dev
   git push -u origin dev
   ```
3. **Workflow:** Do feature work and fixes on `dev` (or feature branches merging into `dev`). When ready to release, merge `dev` → `main`. Only `main` should be connected to the production domain blinkify.ai.

---

## 3. Vercel project (one project for the landing page)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. **Import** your Blinkify repo. When asked:
   - **Root Directory:** leave default (repo root).
   - **Framework Preset:** Next.js (Vercel usually detects it).
   - **Build Command:** `cd apps/web && npm run build` (or from root: `npm run build` if the root `package.json` runs `turbo run build` and builds `apps/web`).
   - **Output Directory:** leave default for Next.js (`apps/web/.next` is used automatically when build runs in `apps/web`; if building from root with Turbo, Vercel will infer it).
3. **Important:** Set **Root Directory** in Vercel to `apps/web` so Vercel runs `next build` in the right place:
   - Project Settings → General → **Root Directory** → `apps/web`.
   - Then **Build Command** can stay `npm run build` (or override to `npm run build`).
4. Under **Settings → Git**, set **Production Branch** to `main`. Optional: enable **Preview** for other branches (e.g. `dev`) so each push to `dev` gets a preview URL.

**Environment variables (Production)** – add these in Vercel for the **Production** environment (used when deploying from `main`):

```bash
NEXT_PUBLIC_APP_URL=https://blinkify.ai
NEXT_PUBLIC_API_URL=https://api.blinkify.ai
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

For a **landing-only** launch you can defer the API and Supabase if the landing page doesn’t call them (e.g. no signup/signin yet). If you have a “Start free trial” that hits the API or Supabase, set them before go-live.

---

## 4. Domain: blinkify.ai

1. **DNS:** At your registrar, add a CNAME (or A/ALIAS if Vercel instructs) for `blinkify.ai` (and optionally `www.blinkify.ai`) pointing to Vercel (e.g. `cname.vercel-dns.com` or the value Vercel shows).
2. **Vercel:** In the project, go to **Settings → Domains**, add `blinkify.ai` (and `www.blinkify.ai` if you use it). Vercel will issue SSL.

**Later (app.blinkify.ai):** When you launch the webapp, create a **second Vercel project** (same repo, same `apps/web`, different env): set `NEXT_PUBLIC_APP_URL=https://app.blinkify.ai` and attach domain `app.blinkify.ai`. That build will be noindex and not in the sitemap (your code already does this when `NEXT_PUBLIC_APP_URL` contains `app.blinkify.ai`).

---

## 5. Pre-launch checks (landing only)

- [ ] **Build:** From repo root run `npm run build` (or from `apps/web`: `npm run build`). Fix any build errors.
- [ ] **Links:** All CTA buttons (e.g. “Start Free Trial”, “Sign up”) point to the right place. For landing-only you may point to `#` or a waitlist; when you add app, point to `https://app.blinkify.ai/signup`.
- [ ] **Legal:** Footer links to `/privacy`, `/terms`, `/cookies`; those pages exist and render.
- [ ] **SEO:** With `NEXT_PUBLIC_APP_URL=https://blinkify.ai`, `/robots.txt` allows `/` and disallows `/dashboard/`, `/signin`, `/signup`, `/reset-password`; `/sitemap.xml` includes `/`, `/privacy`, `/terms`, `/cookies`.
- [ ] **No app routes on marketing URL:** Users should not land on `/dashboard` or sign-in from blinkify.ai in production until you point those to app.blinkify.ai. You can keep routes in the codebase but not link to them from the marketing site.
- [ ] **Env:** No `.env` or secrets committed; production env only in Vercel (and optional Supabase/API host for later).

---

## 6. Order of operations (summary)

1. Create GitHub repo (if not done), push code, create `dev` and push it.
2. In Vercel: import repo, set **Root Directory** to `apps/web`, **Production Branch** to `main`.
3. Add production env vars in Vercel (at least `NEXT_PUBLIC_APP_URL=https://blinkify.ai`).
4. Add domain `blinkify.ai` in Vercel and DNS.
5. Merge to `main` (or deploy from `main`) and verify https://blinkify.ai loads.
6. Run through the pre-launch checklist above.

---

## 7. What to look out for

- **Monorepo:** Vercel must build from `apps/web` (Root Directory = `apps/web`). If you use Turborepo from root, ensure the build command runs from root and produces output in `apps/web` so Vercel can serve it (or use Root Directory `apps/web` and run `npm run build` there; install deps via Vercel’s automatic detection or a root `install` that links workspaces).
- **Env:** Changing `NEXT_PUBLIC_*` requires a new build; trigger a redeploy after editing env in Vercel.
- **CORS / API:** When you add the API (e.g. api.blinkify.ai), set the API’s `WEB_ORIGIN` to `https://blinkify.ai` for the marketing site and later to `https://app.blinkify.ai` for the app (or both if the API allows multiple origins).
- **Two deployments:** One Vercel project = blinkify.ai (marketing). Later, second project = app.blinkify.ai (same repo, different `NEXT_PUBLIC_APP_URL` and domain). No Expo needed for either.
