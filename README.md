# Blinkify

**Open-source AI ad creative platform.** Upload a product photo and get campaign-ready visuals — Meta ads, TikTok creatives, product videos, email images, and social copy — without a designer.

Hosted product: [blinkify.ai](https://blinkify.ai)

[Features](#what-it-does) · [Quick start](#quick-start) · [Architecture](#architecture) · [Docs](#documentation) · [License](#license)

---

## What it is

Blinkify is a full B2B SaaS you can run yourself. A brand (or agency) creates a workspace, adds a product/project with brand colors, fonts, and a logo, then generates ads from the Creative Studio.

The model is **one upload → many on-brand outputs**. Generation runs server-side through Google Gemini. Auth, files, and data live in Supabase. Optional Polar.sh handles paid plans.

This repository is the same codebase as the hosted product: marketing site, authenticated app, and API.

## What it does

- **Ad creatives** — product photos turned into scroll-stopping stills, including carousel slides
- **Creative Studio** — canvas editor (Konva) plus AI tools for images, video, and email
- **Full campaigns** — a set of channel creatives, videos, and email variants from one brief
- **Brand kit** — colors, fonts, logo, and guidelines applied as generation context
- **Asset collection** — saved outputs per workspace
- **Workspaces & invites** — multi-user teams with roles
- **Credits & plans** — free / standard / pro / agency limits, Polar checkout and webhooks
- **Auth** — email + password and Google via Supabase Auth

## Architecture

```
apps/web          Next.js 16  —  landing, auth, dashboard, studio     :3032
apps/api          Express     —  generation, workspaces, billing      :4001
supabase/         Postgres, Auth, Storage, RLS migrations
```

| Layer | Stack |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui |
| API | Node, Express, TypeScript |
| Data / auth / files | Supabase (Postgres + Auth + Storage) |
| Image & video | Google Gemini (`GEMINI_API_KEY`) |
| Email HTML (optional) | Anthropic (`ANTHROPIC_API_KEY`) |
| Transactional email (optional) | Resend |
| Billing (optional) | Polar.sh |

npm workspaces + Turborepo. Install with **Bun** or npm.

## Quick start

You need Node 20+, [Bun](https://bun.sh/) (or npm 10+), a Supabase project, and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/jbossdev16/Blinkify.git
cd Blinkify
bun install

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Edit both files. Use **your** Supabase URL and keys — never commit them.

Apply migrations to that Supabase project:

```bash
bunx supabase db push
```

Or paste the SQL in `supabase/migrations/` into the Supabase SQL editor, in filename order.

```bash
bun run dev
```

| App | URL |
| --- | --- |
| Web | http://localhost:3032 |
| API health | http://localhost:4001/health |

On localhost, marketing and app routes are all available (no `blinkify.ai` / `app.blinkify.ai` split).

npm works the same: `npm install`, `npm run dev`.

## Environment

Full table: **[docs/environment.md](docs/environment.md)**. Minimum to boot locally:

**`apps/api/.env`**

```bash
PORT=4001
WEB_ORIGIN=http://localhost:3032
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

**`apps/web/.env.local`**

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3032
NEXT_PUBLIC_API_URL=http://localhost:4001
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never put it in a `NEXT_PUBLIC_*` variable.

## Database and storage

Migrations under `supabase/migrations/` create tables, RLS, and buckets:

| Bucket | Public | Used for |
| --- | --- | --- |
| `project-assets` | no | uploads, brand files |
| `generated-images` | no | ad stills (API issues signed URLs) |
| `generated-videos` | no | video outputs |
| `email-assets` | yes | images embedded in copied email HTML (created by the API on boot if missing) |

See [docs/storage.md](docs/storage.md). Google sign-in: [docs/google-signin.md](docs/google-signin.md).

## Deploy

Typical production shape is three things: the Next.js app, the Express API, and one Supabase project.

Vercel (what the hosted product uses): [docs/deploy.md](docs/deploy.md).

Env checklist for any host: [docs/environment.md](docs/environment.md).

## Commands

From the repo root:

| Command | What it does |
| --- | --- |
| `bun run dev` | Web + API in development |
| `bun run build` | Build all apps |
| `bun run lint` | Lint all apps |
| `bun run clean` | Remove build artifacts and `node_modules` |

Add shadcn components from `apps/web`:

```bash
cd apps/web && bunx shadcn@latest add button
```

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/environment.md](docs/environment.md) | Every environment variable |
| [docs/self-hosting.md](docs/self-hosting.md) | Local and production setup order |
| [docs/deploy.md](docs/deploy.md) | Vercel / domain notes |
| [docs/google-signin.md](docs/google-signin.md) | Google OAuth + Supabase |
| [docs/storage.md](docs/storage.md) | Storage buckets |
| [docs/IMAGE_GENERATION_PROMPTS.md](docs/IMAGE_GENERATION_PROMPTS.md) | Image prompt / system-instruction reference |
| [docs/NANO_BANANA_IMAGE_API.md](docs/NANO_BANANA_IMAGE_API.md) | Gemini image API notes |

## Security

- Real `.env` files are gitignored. Only `.env.example` files belong in git.
- Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).
- If you fork this for a live product, create **your own** Supabase project, Gemini key, and Polar org. Do not reuse anyone else's credentials.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). Use it, fork it, self-host it, sell a hosted version — keep the copyright notice.
