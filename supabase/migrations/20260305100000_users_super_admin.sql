-- Add super-admin flag to users table.
-- Default false; set manually for Blinkify admin accounts.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
