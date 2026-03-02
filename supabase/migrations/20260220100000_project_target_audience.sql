-- Add target_audience to projects for AI ad creative context
alter table public.projects
  add column if not exists target_audience text;

comment on column public.projects.target_audience is 'Who the brand targets; helps AI tailor ad creatives (demographics, interests, etc.)';
