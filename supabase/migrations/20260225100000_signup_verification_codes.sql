-- Signup verification codes: persistent store for email verification (replaces in-memory only).
-- Enables multi-instance API and survives restarts. Run this migration when ready.

create table if not exists public.signup_verification_codes (
  email_normalized text primary key,
  code text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  signup_data jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_signup_verification_codes_expires_at
  on public.signup_verification_codes (expires_at);

comment on table public.signup_verification_codes is
  'Temporary signup verification codes; prune expired rows periodically.';
