# Contributing to Blinkify

Thanks for helping. Keep changes focused, and do not commit secrets.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer
- [Bun](https://bun.sh/) (preferred) or npm 10+
- A [Supabase](https://supabase.com/) project
- A [Google AI](https://aistudio.google.com/apikey) Gemini API key (for generation)

## Local setup

```bash
git clone https://github.com/jbossdev16/Blinkify.git
cd Blinkify
bun install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill both env files with **your** keys. See [docs/environment.md](docs/environment.md).

Apply database migrations to your Supabase project (SQL editor or Supabase CLI):

```bash
bunx supabase db push
```

Start both apps from the repo root:

```bash
bun run dev
```

- Web: http://localhost:3032
- API: http://localhost:4001 (`/health` should return 200)

## Project layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 16 app — marketing site, auth, dashboard, Creative Studio |
| `apps/api` | Express API — auth, workspaces, generation, billing webhooks |
| `supabase/migrations` | Postgres schema, RLS, storage buckets |
| `docs/` | Setup, deploy, and generation notes |

## How to contribute

1. Open an issue first for anything larger than a small fix.
2. Branch from `main`.
3. Match the style of the surrounding code. Do not drive-by reformat unrelated files.
4. Do not add real API keys, tokens, project refs from a live environment, or `.env` files.
5. If you change env vars, update `.env.example` and `docs/environment.md` in the same PR.
6. Open a pull request with a short description of **why** the change exists.

## Checks

```bash
bun run lint
bun run build
```

Web build embeds `NEXT_PUBLIC_*` at compile time. Local production-style builds need those set in `apps/web/.env.local`.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do not file public issues for vulnerabilities.
