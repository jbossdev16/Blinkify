-- =============================================================================
-- Phase 3: Image Generation Support
-- Created: 2026-02-11
-- Adds: generations.workspace_id, aspect_ratio, text_response
-- Creates: generated-images storage bucket + policies
-- =============================================================================

-- ─── ADD: generations.workspace_id ──────────────────────────────────────────
-- Denormalised for fast per-workspace queries (consistent with project_assets).

alter table public.generations
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

-- Backfill workspace_id from the parent project
update public.generations g
  set workspace_id = p.workspace_id
  from public.projects p
  where g.project_id = p.id
    and g.workspace_id is null;

-- Now make it not null for future rows
-- (skip if backfill left orphans — shouldn't happen with FK cascade)
alter table public.generations
  alter column workspace_id set not null;

create index if not exists idx_generations_workspace
  on public.generations (workspace_id);

-- ─── ADD: generations.aspect_ratio ──────────────────────────────────────────

alter table public.generations
  add column if not exists aspect_ratio text default '1:1';

-- ─── ADD: generations.text_response ─────────────────────────────────────────
-- Stores any text the model returned alongside the image.

alter table public.generations
  add column if not exists text_response text;

-- ─── STORAGE: generated-images bucket ───────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('generated-images', 'generated-images', false)
  on conflict (id) do nothing;

-- Policy: authenticated users can read their workspace's generated images
-- (via signed URLs from the API the bucket is private, but this allows
--  direct reads if needed later)
create policy "workspace_members_read_generated_images"
  on storage.objects for select
  using (
    bucket_id = 'generated-images'
    and auth.role() = 'authenticated'
    and public.is_workspace_member(
      (storage.foldername(name))[1]::uuid
    )
  );

-- Policy: only the service role (API) can insert/update/delete
-- (no user-facing write policy needed — the API uses service_role key)

-- ─── UPDATE: generations RLS to use workspace_id directly ───────────────────
-- Previously the select policy did a subquery to projects to get workspace_id.
-- Now that workspace_id is on generations, we can reference it directly.

drop policy if exists "generations_select_member" on public.generations;
create policy "generations_select_member"
  on public.generations for select
  using (
    deleted_at is null
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "generations_select_trash" on public.generations;
create policy "generations_select_trash"
  on public.generations for select
  using (
    deleted_at is not null
    and public.is_workspace_member(workspace_id)
  );

drop policy if exists "generations_insert_member" on public.generations;
create policy "generations_insert_member"
  on public.generations for insert
  with check (
    public.is_workspace_member(workspace_id)
  );
