-- Enable RLS on signup_verification_codes.
-- This table stores sensitive data (verification codes, passwords in signup_data).
-- Only the API (service_role) should access it; no user-facing policies needed.

alter table public.signup_verification_codes enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated roles.
-- The API uses service_role which bypasses RLS.

-- Also add a missing INSERT policy on users so authenticated users can create
-- their own row (defense-in-depth alongside the service_role API flow).

create policy "users_insert_self"
  on public.users for insert
  with check (auth_provider_id = auth.uid()::text);
