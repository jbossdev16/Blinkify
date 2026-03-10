# Google sign-in setup (Supabase Auth)

Your app already uses Supabase’s Google OAuth on signup and signin (`signInWithOAuth({ provider: "google", ... })`). To make “Continue with Google” work, configure Google Cloud and Supabase as below.

---

## 1. Google Cloud Console – OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. **APIs & Services → Credentials** → **Create credentials** → **OAuth client ID**.
4. If prompted, set the **OAuth consent screen**:
   - User type: **External** (or Internal for workspace-only).
   - App name, support email, developer contact; add your domain under **Authorized domains** (e.g. `blinkify.ai`).
   - Scopes: add `email`, `profile`, `openid` (often already included).
   - Save.
5. Back in **Credentials**, create **OAuth client ID**:
   - Application type: **Web application**.
   - Name: e.g. `Blinkify Web`.
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (dev)
     - Your production origin, e.g. `https://app.blinkify.ai` (or `https://blinkify.ai` if that’s where signup/signin live).
   - **Authorized redirect URIs** – add **Supabase’s callback URL**:
     - `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
     - Example: `https://tcbziypuirgizkqlslzw.supabase.co/auth/v1/callback`
     - Find your project ref in Supabase Dashboard → Project Settings → General → Reference ID.
6. **Create** and copy the **Client ID** and **Client secret**.

---

## 2. Supabase Dashboard – Google provider

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. **Authentication** → **Providers** → **Google**.
3. Enable **Google**.
4. Paste **Client ID** and **Client secret** from step 1.
5. **Save**.

---

## 3. Supabase – Redirect URLs

1. **Authentication** → **URL Configuration**.
2. **Site URL**: the main origin users see (e.g. `https://app.blinkify.ai` or `http://localhost:3000` for dev).
3. **Redirect URLs**: add every origin/path your app uses as `redirectTo` after login:
   - `http://localhost:3000/dashboard`
   - `http://localhost:3000/**` (optional; wildcard for dev)
   - `https://app.blinkify.ai/dashboard`
   - `https://app.blinkify.ai/**` (optional)
   - Add `/signin` if you redirect there in some flows.

Your app currently uses:
- Signup: `redirectTo: ${origin}/dashboard`
- Signin: `redirectTo: ${origin}${returnTo}` (e.g. `/dashboard` or a path like `/creative-studio`)

So at least:
- `http://localhost:3000/dashboard` and `http://localhost:3000/**` for dev.
- `https://app.blinkify.ai/dashboard` and `https://app.blinkify.ai/**` for prod (or your real app origin).

---

## 4. Local dev – optional

For local testing, in **Google OAuth client** you already added `http://localhost:3000` as authorized origin and in Supabase you added `http://localhost:3000/dashboard` (and optionally `http://localhost:3000/**`) as redirect URLs. No code change needed.

---

## 5. Verify

1. Open signup or signin (e.g. `http://localhost:3000/signup` or your app URL).
2. Click **Continue with Google**.
3. Sign in with Google; you should be redirected back to `/dashboard` (or your `returnTo` path) with a session.
4. Your API uses `ensureCurrentUser` and creates a `users` row from the JWT (`sub`, `email`, `name`, `picture`) when missing, so the first dashboard load after Google sign-in should work without extra setup.

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Redirect URI mismatch | Redirect URI in Google must be exactly `https://<ref>.supabase.co/auth/v1/callback`. No trailing slash. |
| “Redirect URL not allowed” | Add the exact `redirectTo` URL (e.g. `https://app.blinkify.ai/dashboard`) in Supabase **Redirect URLs**. |
| User not found after login | API uses `auth_provider_id = JWT sub` and auto-provisions via `ensureCurrentUser`; ensure API has valid Supabase anon key and can read/write `users`. |
| Cookies not set | App uses `@supabase/ssr` and middleware; ensure signup/signin run on the same origin as the redirect (no cross-origin redirect from Supabase to a different subdomain unless both are in Redirect URLs and cookie domain is correct). |

---

## Summary

- **Google Cloud:** Web OAuth client, authorized origin = app origin, redirect URI = Supabase callback only.
- **Supabase:** Google provider enabled with Client ID/secret; Site URL and Redirect URLs include app origin and `/dashboard` (and any other `redirectTo` paths).

No code changes are required in your repo for a standard setup; only Google and Supabase configuration.
