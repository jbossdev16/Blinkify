# Security Policy

## Supported versions

This repository is the current development line. Security fixes land on `main`.

## Reporting a vulnerability

Do **not** open a public GitHub issue for security problems.

Email **hamza@blinkify.ai** with:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Affected files or endpoints if you know them

You will get a reply acknowledging the report. Please give a reasonable window to investigate and ship a fix before any public disclosure.

## Secrets and credentials

This project is designed so that **no real secrets live in the repo**.

| Safe to commit | Never commit |
| --- | --- |
| `.env.example` files with placeholders | `.env`, `.env.local`, `.env.production` |
| Public product URLs | `SUPABASE_SERVICE_ROLE_KEY` |
| Anon-key **placeholders** | Real anon keys, service role keys, Gemini / Resend / Polar / Anthropic tokens |
| Migrations and RLS policies | Database connection strings with passwords |

If you accidentally commit a secret:

1. Rotate the key immediately in the provider dashboard (treat it as public).
2. Remove it from the tree in a new commit.
3. Remember that git history still contains the old value until history is rewritten. Rotation is the real fix.

## Self-host checklist

- Keep `SUPABASE_SERVICE_ROLE_KEY` on the API only. Never prefix it with `NEXT_PUBLIC_`.
- Enable Row Level Security on every public table (the migrations already do this).
- Set `WEB_ORIGIN` to your exact frontend origin. Do not use `*`.
- Verify Polar webhooks with `POLAR_WEBHOOK_SECRET`.
- Restrict `BLINKIFY_ADMIN_EMAILS` to people who should open `/admin`.
