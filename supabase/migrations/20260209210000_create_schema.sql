-- =============================================================================
-- Blinkify Core Schema
-- Created: 2026-02-09
-- Tables: users, workspaces, workspace_members, projects, generations, assets
-- =============================================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp" with schema extensions;

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Maps Auth0 identity (sub) to an internal UUID.
-- All other tables reference this internal id, not the Auth0 sub directly.
-- If you ever switch auth providers, only this table needs updating.

create table public.users (
  id          uuid primary key default extensions.uuid_generate_v4(),
  auth0_id    text not null unique,             -- Auth0 "sub" (e.g. "auth0|abc123")
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_users_auth0_id on public.users (auth0_id);

-- ─── WORKSPACES ──────────────────────────────────────────────────────────────
-- Per-workspace billing model. Each user gets one workspace on signup.
-- plan is TEXT (not enum) so you can rename / add plans without a migration.
-- credits default to 0; the API sets the right amount based on plan / trial.
-- trial_ends_at is set by the API when a trial starts (e.g. now + 7 days).

create table public.workspaces (
  id              uuid primary key default extensions.uuid_generate_v4(),
  name            text not null,
  owner_id        uuid not null references public.users (id) on delete cascade,
  plan            text not null default 'trial',  -- e.g. trial, standard, pro, agency, enterprise
  credits         integer not null default 0,
  trial_ends_at   timestamptz,                    -- null = no active trial
  stripe_customer_id   text,                      -- set when Stripe is wired
  stripe_subscription_id text,                    -- set when Stripe is wired
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_workspaces_owner on public.workspaces (owner_id);

-- ─── WORKSPACE MEMBERS ───────────────────────────────────────────────────────
-- Ties users to workspaces with a role.
-- role is TEXT so you can add roles later without a migration.
-- Unique constraint prevents duplicate memberships.

create table public.workspace_members (
  id            uuid primary key default extensions.uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  role          text not null default 'member',  -- owner, admin, member
  created_at    timestamptz not null default now(),

  unique (workspace_id, user_id)
);

create index idx_wm_workspace on public.workspace_members (workspace_id);
create index idx_wm_user      on public.workspace_members (user_id);

-- ─── PROJECTS ────────────────────────────────────────────────────────────────
-- One project per product or ad series. Belongs to a workspace.

create table public.projects (
  id            uuid primary key default extensions.uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_projects_workspace on public.projects (workspace_id);

-- ─── GENERATIONS ─────────────────────────────────────────────────────────────
-- Tracks every AI image generation request.

create table public.generations (
  id            uuid primary key default extensions.uuid_generate_v4(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete set null,  -- NOTE: fixed in 20260209220000 (nullable + set null)
  status        text not null default 'pending',  -- pending, processing, completed, failed
  credits_used  integer not null default 1,
  prompt        text,
  result_url    text,                             -- URL of generated image in storage
  error_message text,
  created_at    timestamptz not null default now()
);

create index idx_generations_project on public.generations (project_id);
create index idx_generations_user    on public.generations (user_id);

-- ─── ASSETS ──────────────────────────────────────────────────────────────────
-- Uploaded or generated files belonging to a project.

create table public.assets (
  id          uuid primary key default extensions.uuid_generate_v4(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  type        text not null default 'image',  -- image, video
  url         text not null,
  metadata    jsonb default '{}'::jsonb,       -- dimensions, format, etc.
  created_at  timestamptz not null default now()
);

create index idx_assets_project on public.assets (project_id);

-- ─── updated_at TRIGGER ──────────────────────────────────────────────────────
-- Auto-updates updated_at on any row change for tables that have that column.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger trg_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();


-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
-- IMPORTANT: The API uses the Supabase service_role key, which BYPASSES RLS.
-- These policies protect data when accessed via the anon/user key (e.g. from
-- the frontend or Supabase client with a user JWT).
--
-- Helper: all policies use a common function to get the current user's internal
-- UUID from the Auth0 "sub" stored in the JWT. This keeps policies clean and
-- makes them easy to update if the auth strategy changes.
-- =============================================================================

-- ─── Helper: get current user's internal UUID from JWT ───────────────────────
-- Reads the Auth0 "sub" from the JWT claims and looks up the users table.
-- Returns NULL if no matching user (policies will deny access in that case).

create or replace function public.current_user_id()
returns uuid as $$
  select id from public.users
  where auth0_id = coalesce(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    ''
  )
  limit 1;
$$ language sql stable security definer;

-- ─── Helper: check if user is a member of a workspace ────────────────────────

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = public.current_user_id()
  );
$$ language sql stable security definer;

-- ─── Helper: check if user has a specific role in a workspace ────────────────

create or replace function public.has_workspace_role(ws_id uuid, required_role text)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = public.current_user_id()
      and role = required_role
  );
$$ language sql stable security definer;

-- ─── USERS RLS ───────────────────────────────────────────────────────────────

alter table public.users enable row level security;

-- Users can read their own row
create policy "users_select_own"
  on public.users for select
  using (id = public.current_user_id());

-- Users can update their own row (name, avatar, etc.)
create policy "users_update_own"
  on public.users for update
  using (id = public.current_user_id());

-- ─── WORKSPACES RLS ──────────────────────────────────────────────────────────

alter table public.workspaces enable row level security;

-- Members can view workspaces they belong to
create policy "workspaces_select_member"
  on public.workspaces for select
  using (public.is_workspace_member(id));

-- Only owner can update workspace (name, plan, etc.)
create policy "workspaces_update_owner"
  on public.workspaces for update
  using (public.has_workspace_role(id, 'owner'));

-- ─── WORKSPACE MEMBERS RLS ──────────────────────────────────────────────────

alter table public.workspace_members enable row level security;

-- Members can see who else is in their workspace
create policy "wm_select_member"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

-- Only owner/admin can add members
create policy "wm_insert_admin"
  on public.workspace_members for insert
  with check (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- Only owner/admin can remove members
create policy "wm_delete_admin"
  on public.workspace_members for delete
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- ─── PROJECTS RLS ────────────────────────────────────────────────────────────

alter table public.projects enable row level security;

-- Members can view projects in their workspaces
create policy "projects_select_member"
  on public.projects for select
  using (public.is_workspace_member(workspace_id));

-- Members can create projects in their workspaces
create policy "projects_insert_member"
  on public.projects for insert
  with check (public.is_workspace_member(workspace_id));

-- Members can update projects in their workspaces
create policy "projects_update_member"
  on public.projects for update
  using (public.is_workspace_member(workspace_id));

-- Only owner/admin can delete projects
create policy "projects_delete_admin"
  on public.projects for delete
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- ─── GENERATIONS RLS ─────────────────────────────────────────────────────────

alter table public.generations enable row level security;

-- Members can view generations in projects they have access to
create policy "generations_select_member"
  on public.generations for select
  using (
    public.is_workspace_member(
      (select workspace_id from public.projects where id = project_id)
    )
  );

-- Members can create generations
create policy "generations_insert_member"
  on public.generations for insert
  with check (
    public.is_workspace_member(
      (select workspace_id from public.projects where id = project_id)
    )
  );

-- ─── ASSETS RLS ──────────────────────────────────────────────────────────────

alter table public.assets enable row level security;

-- Members can view assets in projects they have access to
create policy "assets_select_member"
  on public.assets for select
  using (
    public.is_workspace_member(
      (select workspace_id from public.projects where id = project_id)
    )
  );

-- Members can upload assets to projects they have access to
create policy "assets_insert_member"
  on public.assets for insert
  with check (
    public.is_workspace_member(
      (select workspace_id from public.projects where id = project_id)
    )
  );

-- Members can delete their project assets (owner/admin)
create policy "assets_delete_admin"
  on public.assets for delete
  using (
    public.has_workspace_role(
      (select workspace_id from public.projects where id = project_id),
      'owner'
    )
    or public.has_workspace_role(
      (select workspace_id from public.projects where id = project_id),
      'admin'
    )
  );
