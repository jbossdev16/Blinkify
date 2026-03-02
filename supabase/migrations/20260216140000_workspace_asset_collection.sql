-- =============================================================================
-- Workspace Asset Collection
-- Created: 2026-02-16
-- User-bookmarked images/videos from generations. Survives chat reload.
-- =============================================================================

create table public.workspace_asset_collection (
  id                   uuid primary key default extensions.uuid_generate_v4(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  generation_id        uuid references public.generations (id) on delete cascade,
  video_generation_id  uuid references public.video_generations (id) on delete cascade,
  created_at           timestamptz not null default now(),
  constraint exactly_one_ref check (
    (generation_id is not null and video_generation_id is null) or
    (generation_id is null and video_generation_id is not null)
  )
);

create index idx_workspace_asset_collection_workspace on public.workspace_asset_collection (workspace_id);
create unique index idx_workspace_asset_collection_image_unique
  on public.workspace_asset_collection (workspace_id, generation_id)
  where generation_id is not null;
create unique index idx_workspace_asset_collection_video_unique
  on public.workspace_asset_collection (workspace_id, video_generation_id)
  where video_generation_id is not null;

alter table public.workspace_asset_collection enable row level security;

create policy "workspace_asset_collection_select_member"
  on public.workspace_asset_collection for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace_asset_collection_insert_member"
  on public.workspace_asset_collection for insert
  with check (public.is_workspace_member(workspace_id));

create policy "workspace_asset_collection_delete_member"
  on public.workspace_asset_collection for delete
  using (public.is_workspace_member(workspace_id));
