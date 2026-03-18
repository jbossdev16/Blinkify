alter table public.workspaces
  add column if not exists polar_subscription_id text;

comment on column public.workspaces.polar_subscription_id is 'Polar.sh subscription id (webhook / billing)';
