-- RPC to look up auth user by email without listing all users.
-- Uses auth.users (Supabase internal). Run this migration when ready.

create or replace function public.get_auth_user_by_email(search_email text)
returns table (id uuid, email_confirmed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select au.id, au.email_confirmed_at
  from auth.users au
  where lower(au.email) = lower(search_email)
  limit 1;
$$;

comment on function public.get_auth_user_by_email(text) is
  'Look up a single auth user by email (service role). Used by signup to avoid listUsers.';
