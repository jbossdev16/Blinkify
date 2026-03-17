-- Campaign sessions: stores complete Full Campaign outputs for history and analytics.
-- NOT APPLIED — create this table before using the campaign/generate endpoint.

create table if not exists campaign_sessions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  project_id      uuid not null references projects(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  campaign_goal   text not null,
  platforms_selected jsonb not null default '[]'::jsonb,
  claude_output   jsonb not null default '{}'::jsonb,
  asset_urls      jsonb not null default '{}'::jsonb,
  credits_used    integer not null default 0,
  status          text not null default 'pending',
  created_at      timestamptz not null default now()
);

create index if not exists idx_campaign_sessions_workspace on campaign_sessions(workspace_id);
create index if not exists idx_campaign_sessions_project on campaign_sessions(project_id);
create index if not exists idx_campaign_sessions_user on campaign_sessions(user_id);
create index if not exists idx_campaign_sessions_created on campaign_sessions(created_at desc);

alter table campaign_sessions enable row level security;

create policy "Users can view own campaign sessions"
  on campaign_sessions for select
  using (user_id = auth.uid());

create policy "Service role full access to campaign_sessions"
  on campaign_sessions for all
  using (true)
  with check (true);
