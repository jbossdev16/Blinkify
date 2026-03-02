-- Add overlay_storage_path to store the Remotion-rendered version with overlays.
ALTER TABLE public.video_generations
  ADD COLUMN IF NOT EXISTS overlay_storage_path text;

COMMENT ON COLUMN public.video_generations.overlay_storage_path IS 'Path in generated-videos bucket for version with overlay skills applied.';
