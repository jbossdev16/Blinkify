-- =============================================================================
-- Creative Studio chat history (Supabase-backed)
-- One row per workspace; data = { messages, prompt, selectedTool, options, ... }
-- Do not apply until you are ready; run: supabase db push (or apply manually).
-- =============================================================================

create table public.creative_studio_chats (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

create trigger trg_creative_studio_chats_updated_at
  before update on public.creative_studio_chats
  for each row execute function public.set_updated_at();

alter table public.creative_studio_chats enable row level security;

create policy "creative_studio_chats_select_member"
  on public.creative_studio_chats for select
  using (public.is_workspace_member(workspace_id));

create policy "creative_studio_chats_insert_member"
  on public.creative_studio_chats for insert
  with check (public.is_workspace_member(workspace_id));

create policy "creative_studio_chats_update_member"
  on public.creative_studio_chats for update
  using (public.is_workspace_member(workspace_id));

create policy "creative_studio_chats_delete_member"
  on public.creative_studio_chats for delete
  using (public.is_workspace_member(workspace_id));
