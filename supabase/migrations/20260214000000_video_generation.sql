-- =============================================================================
-- Video generation support
-- Created: 2026-02-14
-- Tables: project_video_chats, video_generations
-- Storage: generated-videos bucket
-- =============================================================================

-- ─── project_video_chats ─────────────────────────────────────────────────────
-- One row per project; data = { messages, prompt?, options?, showOptions? }
-- Mirrors project_chats structure for video generation chat.

create table public.project_video_chats (
  project_id   uuid primary key references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create index idx_project_video_chats_workspace on public.project_video_chats (workspace_id);

create trigger trg_project_video_chats_updated_at
  before update on public.project_video_chats
  for each row execute function public.set_updated_at();

alter table public.project_video_chats enable row level security;

create policy "project_video_chats_select_member"
  on public.project_video_chats for select
  using (public.is_workspace_member(workspace_id));

create policy "project_video_chats_insert_member"
  on public.project_video_chats for insert
  with check (public.is_workspace_member(workspace_id));

create policy "project_video_chats_update_member"
  on public.project_video_chats for update
  using (public.is_workspace_member(workspace_id));

create policy "project_video_chats_delete_member"
  on public.project_video_chats for delete
  using (public.is_workspace_member(workspace_id));

-- ─── video_generations ───────────────────────────────────────────────────────
-- Tracks each video generation (Veo long-running op).

create table public.video_generations (
  id              uuid primary key default extensions.uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  user_id         uuid references public.users (id) on delete set null,
  prompt          text not null,
  model           text not null,           -- veo-3.1-generate-preview | veo-3.1-fast-generate-preview
  operation_name  text,                    -- Gemini LRO name for polling
  status          text not null default 'pending',  -- pending, processing, completed, failed
  credits_used    integer not null default 0,
  duration_seconds integer,                -- output video duration
  storage_path    text,                    -- path in generated-videos bucket
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_video_generations_project on public.video_generations (project_id);
create index idx_video_generations_workspace on public.video_generations (workspace_id);
create index idx_video_generations_status on public.video_generations (status) where status in ('pending', 'processing');

create trigger trg_video_generations_updated_at
  before update on public.video_generations
  for each row execute function public.set_updated_at();

alter table public.video_generations enable row level security;

create policy "video_generations_select_member"
  on public.video_generations for select
  using (public.is_workspace_member(workspace_id));

create policy "video_generations_insert_member"
  on public.video_generations for insert
  with check (public.is_workspace_member(workspace_id));

create policy "video_generations_update_member"
  on public.video_generations for update
  using (public.is_workspace_member(workspace_id));

-- ─── Storage: generated-videos bucket ────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('generated-videos', 'generated-videos', false)
  on conflict (id) do nothing;

create policy "workspace_members_read_generated_videos"
  on storage.objects for select
  using (
    bucket_id = 'generated-videos'
    and auth.role() = 'authenticated'
    and public.is_workspace_member(
      (storage.foldername(name))[1]::uuid
    )
  );
