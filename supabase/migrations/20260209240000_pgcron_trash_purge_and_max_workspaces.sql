-- =============================================================================
-- pg_cron: Auto-purge soft-deleted rows after 30 days
-- Also adds max_workspaces to workspaces for plan-based limits.
-- Created: 2026-02-09
-- =============================================================================

-- ─── Enable pg_cron extension ────────────────────────────────────────────────
-- pg_cron is available on Supabase hosted projects (Pro plan and above).
-- On free tier or local dev, this may fail silently — that's OK.

create extension if not exists pg_cron with schema extensions;

-- ─── Purge function ──────────────────────────────────────────────────────────
-- Permanently deletes rows where deleted_at is older than 30 days.
-- Called by the cron job below. Can also be called manually.

create or replace function public.purge_soft_deleted()
returns void as $$
begin
  -- Delete old soft-deleted assets first (child rows)
  delete from public.assets
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  -- Delete old soft-deleted generations
  delete from public.generations
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  -- Delete old soft-deleted projects
  delete from public.projects
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  -- Delete old soft-deleted workspaces (cascade handles members, etc.)
  delete from public.workspaces
  where deleted_at is not null
    and deleted_at < now() - interval '30 days';

  -- Expire old pending invitations
  update public.workspace_invitations
  set status = 'expired', updated_at = now()
  where status = 'pending'
    and expires_at < now();
end;
$$ language plpgsql security definer;

-- ─── Schedule: run daily at 3:00 AM UTC ──────────────────────────────────────
-- If pg_cron is not available, this will fail gracefully.

do $$
begin
  perform cron.schedule(
    'purge-soft-deleted',          -- job name
    '0 3 * * *',                   -- cron expression: daily at 03:00 UTC
    'select public.purge_soft_deleted()'
  );
exception when others then
  raise notice 'pg_cron not available — skip scheduling purge job';
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- max_workspaces: plan-based limit on how many workspaces a user can own
-- ═══════════════════════════════════════════════════════════════════════════════
-- Stored on workspaces so each workspace knows its own limit.
-- The API checks: count of active owned workspaces < max_workspaces.
-- Default 1 for trial/standard; higher for pro/agency/enterprise.

alter table public.workspaces
  add column if not exists max_workspaces integer not null default 1;

comment on column public.workspaces.max_workspaces is
  'Max workspaces the owner can have under this plan. Checked by the API before creating new workspaces.';
