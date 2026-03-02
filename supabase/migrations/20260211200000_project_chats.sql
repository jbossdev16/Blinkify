-- =============================================================================
-- Project chat history (Supabase-backed)
-- Created: 2026-02-11
-- One row per project; data = { messages, prompt?, options?, showOptions? }
-- =============================================================================

create table public.project_chats (
  project_id   uuid primary key references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create index idx_project_chats_workspace on public.project_chats (workspace_id);

-- updated_at trigger
create trigger trg_project_chats_updated_at
  before update on public.project_chats
  for each row execute function public.set_updated_at();

-- RLS: same pattern as generations — workspace members can read/write their project chats
alter table public.project_chats enable row level security;

create policy "project_chats_select_member"
  on public.project_chats for select
  using (public.is_workspace_member(workspace_id));

create policy "project_chats_insert_member"
  on public.project_chats for insert
  with check (public.is_workspace_member(workspace_id));

create policy "project_chats_update_member"
  on public.project_chats for update
  using (public.is_workspace_member(workspace_id));

create policy "project_chats_delete_member"
  on public.project_chats for delete
  using (public.is_workspace_member(workspace_id));
