-- ─── Add brand identity columns to projects ─────────────────────────────────
alter table public.projects
  add column if not exists brand_colors   jsonb default '[]'::jsonb,
  add column if not exists brand_fonts    jsonb default '[]'::jsonb,
  add column if not exists brand_logo     text,
  add column if not exists brand_guidelines text;

comment on column public.projects.brand_colors is 'Array of hex color strings, e.g. ["#007AFF","#FF3B30"]';
comment on column public.projects.brand_fonts is 'Array of {name, type, url?} objects. type: "preset" | "custom"';
comment on column public.projects.brand_logo is 'Supabase Storage path for brand logo';
comment on column public.projects.brand_guidelines is 'Free-text brand guidelines / notes';

-- ─── Project assets table ────────────────────────────────────────────────────
create table if not exists public.project_assets (
  id            uuid primary key default extensions.uuid_generate_v4(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  file_name     text not null,
  file_type     text not null,       -- MIME type
  file_size     bigint not null,     -- bytes
  storage_path  text not null,       -- Supabase Storage path
  uploaded_by   uuid references public.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_project_assets_project on public.project_assets (project_id);
create index if not exists idx_project_assets_workspace on public.project_assets (workspace_id);

-- ─── RLS policies for project_assets ─────────────────────────────────────────
alter table public.project_assets enable row level security;

create policy project_assets_select_member on public.project_assets
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = project_assets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy project_assets_insert_member on public.project_assets
  for insert with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = project_assets.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy project_assets_delete_member on public.project_assets
  for delete using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = project_assets.workspace_id
        and wm.user_id = auth.uid()
    )
  );
