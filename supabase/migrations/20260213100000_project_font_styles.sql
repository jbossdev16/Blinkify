-- Add font_styles to projects for per-element typography (headline, CTA, description)
alter table public.projects
  add column if not exists font_styles jsonb default '{}'::jsonb;

comment on column public.projects.font_styles is 'Per-element font styling: { headline?: { weight?, color?, size? }, cta?: {...}, description?: {...} }. weight: light|normal|medium|semibold|bold. size: small|medium|large. color: hex.';
