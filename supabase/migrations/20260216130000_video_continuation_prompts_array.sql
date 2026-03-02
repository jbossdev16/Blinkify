-- Per-segment continuation prompts (segment 2, 3, 4, ...). One prompt per extend.
-- Gemini durations: 8, 15, 22, 27, 43, 57, 85s → 0, 1, 2, 3, 5, 7, 11 extends.
-- continuation_prompt (text) kept for backward compatibility; continuation_prompts takes precedence when set.
alter table public.video_generations
  add column if not exists continuation_prompts jsonb default '[]'::jsonb;

comment on column public.video_generations.continuation_prompts is 'Optional: array of prompts, one per extended segment (segment 2 = index 0, segment 3 = index 1, ...). Each extend uses the prompt at that index so segment N stays locked.';
