-- =============================================================================
-- Migrate creative_studio_chats from per-workspace to per-project.
-- Each brand/project gets its own independent chat history.
-- =============================================================================

-- 1. Add project_id column (nullable initially for existing rows)
ALTER TABLE public.creative_studio_chats
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- 2. Backfill: assign existing chat rows to the first active project in their workspace
UPDATE public.creative_studio_chats c
SET project_id = (
  SELECT p.id FROM public.projects p
  WHERE p.workspace_id = c.workspace_id
    AND p.deleted_at IS NULL
  ORDER BY p.created_at ASC
  LIMIT 1
)
WHERE c.project_id IS NULL;

-- 3. Drop the old PK (workspace_id) and set new PK (project_id)
ALTER TABLE public.creative_studio_chats DROP CONSTRAINT creative_studio_chats_pkey;
ALTER TABLE public.creative_studio_chats
  ADD CONSTRAINT creative_studio_chats_pkey PRIMARY KEY (project_id);

-- 4. Keep workspace_id as non-null for RLS but allow multiple rows per workspace
ALTER TABLE public.creative_studio_chats
  ALTER COLUMN project_id SET NOT NULL;

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_creative_studio_chats_workspace
  ON public.creative_studio_chats (workspace_id);
