-- Rename auth0_id to auth_provider_id (provider-agnostic)
alter table public.users rename column auth0_id to auth_provider_id;

-- Rename the index
drop index if exists idx_users_auth0_id;
create index idx_users_auth_provider_id on public.users (auth_provider_id);

-- Update RLS helper function to use new column name
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$
  select id from public.users
  where auth_provider_id = coalesce(
    current_setting('request.jwt.claims', true)::json ->> 'sub',
    (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'provider_id')
  )
  limit 1;
$$;
