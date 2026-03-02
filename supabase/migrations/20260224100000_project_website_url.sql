-- Website URL for email marketing: used for CTA buttons and clickable images.
-- Do not apply until you are ready; run: supabase db push (or apply manually).
alter table public.projects
  add column if not exists website_url text;

comment on column public.projects.website_url is 'Brand website URL; used for email CTA buttons and clickable images in email marketing.';
