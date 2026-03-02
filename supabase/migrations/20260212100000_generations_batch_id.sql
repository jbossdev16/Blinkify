-- =============================================================================
-- Add batch_id to generations for N-images-per-request (carousel / A/B ready)
-- Created: 2026-02-12
-- Required for the "Number of images" (1–4) feature. Apply when ready.
-- =============================================================================

alter table public.generations
  add column if not exists batch_id uuid;

comment on column public.generations.batch_id is 'Links multiple generation rows from one user request (N images). Null for legacy single-image rows.';

create index if not exists idx_generations_batch_id
  on public.generations (batch_id)
  where batch_id is not null;
