-- =============================================================================
-- Schema: Invitations, Audit Log, Credit Transactions, Soft Deletes, Storage
-- Created: 2026-02-09
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. WORKSPACE INVITATIONS
-- ═══════════════════════════════════════════════════════════════════════════════
-- When an owner/admin invites someone, a row is created here with status
-- 'pending'. The invitee gets an email with a unique token. When they accept,
-- status flips to 'accepted' and a workspace_members row is created.
-- Expired/declined invitations stay for audit purposes.

create table public.workspace_invitations (
  id            uuid primary key default extensions.uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  invited_by    uuid not null references public.users (id) on delete cascade,
  email         text not null,                        -- invitee's email
  role          text not null default 'member',       -- role they'll get on accept
  status        text not null default 'pending',      -- pending, accepted, declined, expired
  token         text not null unique,                 -- unique invite token for the email link
  expires_at    timestamptz not null,                 -- invitation expiry (e.g. 7 days from now)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_invitations_workspace on public.workspace_invitations (workspace_id);
create index idx_invitations_email     on public.workspace_invitations (email);
create index idx_invitations_token     on public.workspace_invitations (token);

-- Prevent duplicate pending invitations to the same email for the same workspace
create unique index idx_invitations_unique_pending
  on public.workspace_invitations (workspace_id, email)
  where status = 'pending';

-- updated_at trigger
create trigger trg_invitations_updated_at
  before update on public.workspace_invitations
  for each row execute function public.set_updated_at();

-- ─── Invitations RLS ─────────────────────────────────────────────────────────

alter table public.workspace_invitations enable row level security;

-- Owner/admin can view invitations for their workspace
create policy "invitations_select_admin"
  on public.workspace_invitations for select
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- Owner/admin can create invitations
create policy "invitations_insert_admin"
  on public.workspace_invitations for insert
  with check (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- Owner/admin can update invitations (e.g. cancel/expire)
create policy "invitations_update_admin"
  on public.workspace_invitations for update
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- Owner/admin can delete invitations
create policy "invitations_delete_admin"
  on public.workspace_invitations for delete
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════════════════
-- Append-only log of significant actions. The API writes to this table using
-- the service_role key. Owners/admins can read it from the frontend.
-- No updates or deletes allowed via RLS — this is an immutable log.

create table public.audit_events (
  id            uuid primary key default extensions.uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid references public.users (id) on delete set null,  -- who did it (null = system)
  action        text not null,          -- e.g. 'project.created', 'member.invited', 'plan.changed'
  resource_type text,                   -- e.g. 'project', 'workspace', 'member', 'generation'
  resource_id   uuid,                   -- id of the affected resource
  metadata      jsonb default '{}'::jsonb,  -- extra context (old plan, new plan, etc.)
  created_at    timestamptz not null default now()
);

create index idx_audit_workspace  on public.audit_events (workspace_id);
create index idx_audit_user       on public.audit_events (user_id);
create index idx_audit_action     on public.audit_events (action);
create index idx_audit_created    on public.audit_events (created_at desc);

-- ─── Audit RLS ───────────────────────────────────────────────────────────────

alter table public.audit_events enable row level security;

-- Owner/admin can read audit events for their workspace
create policy "audit_select_admin"
  on public.audit_events for select
  using (
    public.has_workspace_role(workspace_id, 'owner')
    or public.has_workspace_role(workspace_id, 'admin')
  );

-- No insert/update/delete via RLS — only the API (service_role) writes audit events


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CREDIT TRANSACTIONS
-- ═══════════════════════════════════════════════════════════════════════════════
-- Every credit change (purchase, generation, refund, trial grant) is logged here.
-- workspaces.credits is the current balance; this table is the full history.
-- Append-only via RLS (only the API writes transactions).

create table public.credit_transactions (
  id            uuid primary key default extensions.uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid references public.users (id) on delete set null,  -- who triggered it (null = system)
  type          text not null,          -- 'generation', 'purchase', 'refund', 'trial_grant', 'plan_grant', 'adjustment'
  amount        integer not null,       -- positive = credit added, negative = credit spent
  balance_after integer not null,       -- workspace credit balance after this transaction
  description   text,                   -- human-readable note (e.g. "Generated image with Imagen 3")
  reference_id  uuid,                   -- optional FK to generation, stripe invoice, etc.
  created_at    timestamptz not null default now()
);

create index idx_credits_workspace on public.credit_transactions (workspace_id);
create index idx_credits_user      on public.credit_transactions (user_id);
create index idx_credits_type      on public.credit_transactions (type);
create index idx_credits_created   on public.credit_transactions (created_at desc);

-- ─── Credit Transactions RLS ─────────────────────────────────────────────────

alter table public.credit_transactions enable row level security;

-- All workspace members can view credit history
create policy "credits_select_member"
  on public.credit_transactions for select
  using (public.is_workspace_member(workspace_id));

-- No insert/update/delete via RLS — only the API (service_role) writes transactions


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. SOFT DELETES
-- ═══════════════════════════════════════════════════════════════════════════════
-- Add deleted_at to workspaces, projects, and assets.
-- NULL = not deleted. When set, the item is "in trash" for 30 days.
-- The API should filter out deleted items by default and permanently purge
-- items where deleted_at < now() - interval '30 days' via a cron/scheduled job.

-- Workspaces
alter table public.workspaces
  add column if not exists deleted_at timestamptz;

-- Projects
alter table public.projects
  add column if not exists deleted_at timestamptz;

-- Assets
alter table public.assets
  add column if not exists deleted_at timestamptz;

-- Generations (keep for history even if project is soft-deleted)
alter table public.generations
  add column if not exists deleted_at timestamptz;

-- Partial indexes: quickly find non-deleted rows (most common query pattern)
create index if not exists idx_workspaces_active
  on public.workspaces (id) where deleted_at is null;

create index if not exists idx_projects_active
  on public.projects (workspace_id) where deleted_at is null;

create index if not exists idx_assets_active
  on public.assets (project_id) where deleted_at is null;

create index if not exists idx_generations_active
  on public.generations (project_id) where deleted_at is null;

-- ─── Update existing RLS policies to exclude soft-deleted rows ───────────────
-- We DROP and re-CREATE the affected SELECT policies so they filter deleted_at.
-- This is the clean way — no stale policies left behind.

-- Workspaces: members can view only non-deleted workspaces they belong to
drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
  on public.workspaces for select
  using (
    deleted_at is null
    and public.is_workspace_member(id)
  );

-- Projects: members can view only non-deleted projects
drop policy if exists "projects_select_member" on public.projects;
create policy "projects_select_member"
  on public.projects for select
  using (
    deleted_at is null
    and public.is_workspace_member(workspace_id)
  );

-- Assets: members can view only non-deleted assets
drop policy if exists "assets_select_member" on public.assets;
create policy "assets_select_member"
  on public.assets for select
  using (
    deleted_at is null
    and public.is_workspace_member(
      (select workspace_id from public.projects where id = project_id)
    )
  );

-- Generations: members can view only non-deleted generations
drop policy if exists "generations_select_member" on public.generations;
create policy "generations_select_member"
  on public.generations for select
  using (
    deleted_at is null
    and public.is_workspace_member(
      (select workspace_id from public.projects where id = project_id)
    )
  );

-- ─── Trash view policies ─────────────────────────────────────────────────────
-- Owner/admin can view soft-deleted items (the "Trash" folder in the UI).
-- These are separate policies so they don't interfere with the main ones.

create policy "projects_select_trash"
  on public.projects for select
  using (
    deleted_at is not null
    and (
      public.has_workspace_role(workspace_id, 'owner')
      or public.has_workspace_role(workspace_id, 'admin')
    )
  );

create policy "assets_select_trash"
  on public.assets for select
  using (
    deleted_at is not null
    and (
      public.has_workspace_role(
        (select workspace_id from public.projects where id = project_id),
        'owner'
      )
      or public.has_workspace_role(
        (select workspace_id from public.projects where id = project_id),
        'admin'
      )
    )
  );

create policy "generations_select_trash"
  on public.generations for select
  using (
    deleted_at is not null
    and (
      public.has_workspace_role(
        (select workspace_id from public.projects where id = project_id),
        'owner'
      )
      or public.has_workspace_role(
        (select workspace_id from public.projects where id = project_id),
        'admin'
      )
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. SUPABASE STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════════════════════
-- Creates a 'project-assets' bucket for generated images, uploads, and exports.
-- The bucket is private (not publicly accessible). Access controlled via policies.
-- Uploads: use the API (service_role) with path {workspace_id}/{project_id}/filename.
-- RLS here applies when using Supabase client with a user JWT (e.g. Auth0->Supabase JWT later).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  false,
  52428800,  -- 50 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do nothing;

-- ─── Storage Policies ────────────────────────────────────────────────────────
-- Storage objects are organized as: project-assets/{workspace_id}/{project_id}/filename
-- This path convention lets us enforce access based on workspace membership.
--
-- NOTE: Supabase storage policies use storage.objects table and check
-- bucket_id + name (the object path). We extract workspace_id from the path.

-- Helper: extract workspace_id from storage object path (first segment)
create or replace function public.workspace_id_from_path(object_name text)
returns uuid as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$ language sql immutable;

-- Authenticated users can read files from workspaces they belong to
create policy "storage_select_member"
  on storage.objects for select
  using (
    bucket_id = 'project-assets'
    and public.is_workspace_member(public.workspace_id_from_path(name))
  );

-- Members can upload files to their workspace folders
create policy "storage_insert_member"
  on storage.objects for insert
  with check (
    bucket_id = 'project-assets'
    and public.is_workspace_member(public.workspace_id_from_path(name))
  );

-- Members can update (overwrite) their workspace files
create policy "storage_update_member"
  on storage.objects for update
  using (
    bucket_id = 'project-assets'
    and public.is_workspace_member(public.workspace_id_from_path(name))
  );

-- Owner/admin can delete files
create policy "storage_delete_admin"
  on storage.objects for delete
  using (
    bucket_id = 'project-assets'
    and (
      public.has_workspace_role(public.workspace_id_from_path(name), 'owner')
      or public.has_workspace_role(public.workspace_id_from_path(name), 'admin')
    )
  );
