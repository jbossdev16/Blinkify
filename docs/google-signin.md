# Google sign-in (Supabase Auth)

The app already calls `signInWithOAuth({ provider: "google", ... })` on signup and signin. You only need Google Cloud + Supabase configuration.

## 1. Google Cloud — OAuth client

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create credentials → OAuth client ID.
2. Configure the OAuth consent screen (External, or Internal for a workspace). Add your domain under Authorized domains.
3. Scopes: `email`, `profile`, `openid`.
4. Application type: **Web application**.
5. **Authorized JavaScript origins**
   - `http://localhost:3032`
   - Your production app origin, e.g. `https://app.yourdomain.com`
6. **Authorized redirect URIs** — only the Supabase callback:

   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```

   Project ref: Supabase → Project Settings → General → Reference ID.

7. Copy the **Client ID** and **Client secret**.

## 2. Supabase — Google provider

1. Authentication → Providers → Google.
2. Enable Google.
3. Paste Client ID and Client secret.
4. Save.

## 3. Supabase — Redirect URLs

Authentication → URL Configuration:

- **Site URL:** `http://localhost:3032` (dev) or `https://app.yourdomain.com` (prod).
- **Redirect URLs** must include every `redirectTo` the app uses:
  - `http://localhost:3032/creative-studio`
  - `http://localhost:3032/**` (optional, local)
  - `https://app.yourdomain.com/creative-studio`
  - `https://app.yourdomain.com/**` (optional)

The app currently uses:

- Signup: `redirectTo: ${origin}/creative-studio`
- Signin: `redirectTo: ${origin}${returnTo}` (usually `/creative-studio`)

## 4. Verify

1. Open `/signup` or `/signin`.
2. Continue with Google.
3. You should land on `/creative-studio` with a session.
4. The API `ensureCurrentUser` path creates the `users` row from the JWT (`sub`, email, name, picture) on first request.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Redirect URI mismatch | Google redirect URI must be exactly `https://<ref>.supabase.co/auth/v1/callback` (no trailing slash). |
| “Redirect URL not allowed” | Add the exact `redirectTo` in Supabase Redirect URLs. |
| User missing after login | API needs a valid anon key and write access to `users`. |
| Cookies missing | Signup/signin and the post-login origin must be listed in Redirect URLs. |

No application code changes are required for a standard setup.
