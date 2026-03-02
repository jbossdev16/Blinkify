-- =============================================================================
-- Schema Improvements
-- Created: 2026-02-09
-- Fixes: generations.user_id FK constraint mismatch
-- Adds:  generations.model, assets.generation_id, workspaces.slug
-- =============================================================================

-- ─── FIX: generations.user_id ────────────────────────────────────────────────
-- Was: NOT NULL + ON DELETE SET NULL (contradicts; delete would fail).
-- Fix: drop the old FK, make column nullable, re-add FK with SET NULL.

alter table public.generations
  alter column user_id drop not null;

alter table public.generations
  drop constraint if exists generations_user_id_fkey;

alter table public.generations
  add constraint generations_user_id_fkey
    foreign key (user_id) references public.users (id) on delete set null;

-- ─── ADD: generations.model ──────────────────────────────────────────────────
-- Tracks which AI model produced the generation (e.g. "imagen-3", "gemini-2").
-- Useful for cost analysis, debugging, and letting users pick models later.

alter table public.generations
  add column if not exists model text;

-- ─── ADD: workspaces.slug ────────────────────────────────────────────────────
-- Unique URL-safe identifier for workspaces (e.g. app.blinkify.ai/ws/my-agency).
-- Nullable for now; the API should generate a slug on workspace creation.

alter table public.workspaces
  add column if not exists slug text;

create unique index if not exists idx_workspaces_slug
  on public.workspaces (slug)
  where slug is not null;  -- partial index: only enforce uniqueness on non-null slugs

-- ─── ADD: assets.generation_id ───────────────────────────────────────────────
-- Optional link from an asset back to the generation that created it.
-- NULL for manually uploaded assets; set for AI-generated ones.

alter table public.assets
  add column if not exists generation_id uuid references public.generations (id) on delete set null;

create index if not exists idx_assets_generation
  on public.assets (generation_id)
  where generation_id is not null;
