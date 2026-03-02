-- Optional prompt for the extended segment (second 7s when duration > 8).
-- When set, the extend API call uses this instead of the main prompt, with instructions
-- to not repeat segment 1 content.
alter table public.video_generations
  add column if not exists continuation_prompt text;

comment on column public.video_generations.continuation_prompt is 'Optional: prompt for the extended segment(s) only. Used when duration > 8s to avoid repeating segment 1.';
