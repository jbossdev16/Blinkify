-- Video overlay skill config: which skills are enabled for users, with default props.
-- Admin configures these; users get automatic overlays based on enabled skills.
CREATE TABLE IF NOT EXISTS video_overlay_skill_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  default_props jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE video_overlay_skill_config IS 'Config for video overlay skills (headline, CTA, etc.). Admin-only.';
