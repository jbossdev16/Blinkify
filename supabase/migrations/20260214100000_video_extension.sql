-- =============================================================================
-- Video extension support (chain extend up to 148s)
-- Created: 2026-02-14
-- =============================================================================

alter table public.video_generations
  add column if not exists extend_index integer not null default 0;

comment on column public.video_generations.extend_index is 'Number of extend steps completed. 0 = initial 8s only. 1 = 15s, etc.';

alter table public.video_generations
  add column if not exists aspect_ratio text default '16:9';

alter table public.video_generations
  add column if not exists resolution text default '720p';
