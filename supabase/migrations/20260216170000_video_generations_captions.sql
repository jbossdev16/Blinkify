-- UGC-style captions: opt-in, Whisper → ASS → ffmpeg burn-in.
-- Keep original video; captioned version stored separately when requested.

ALTER TABLE public.video_generations
  ADD COLUMN IF NOT EXISTS add_captions boolean NOT NULL DEFAULT false;

ALTER TABLE public.video_generations
  ADD COLUMN IF NOT EXISTS storage_path_captioned text;

ALTER TABLE public.video_generations
  ADD COLUMN IF NOT EXISTS caption_error text;

COMMENT ON COLUMN public.video_generations.add_captions IS 'Whether user requested UGC-style burned-in captions.';
COMMENT ON COLUMN public.video_generations.storage_path_captioned IS 'Path in generated-videos bucket for version with captions burned in.';
COMMENT ON COLUMN public.video_generations.caption_error IS 'Error message if captioning failed; user still gets uncaptioned video.';
