ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS social_links jsonb
  DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.projects.social_links IS
  'Brand social media and contact links. Keys: instagram, tiktok, facebook, x, linkedin, pinterest, youtube, contact_email, address';
