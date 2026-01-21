-- Developer database snapshots (stored server-side, accessed only via backend functions)
CREATE TABLE IF NOT EXISTS public.dev_db_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  label text NULL,
  data jsonb NOT NULL
);

ALTER TABLE public.dev_db_snapshots ENABLE ROW LEVEL SECURITY;

-- Intentionally no RLS policies: direct client access is denied.

CREATE INDEX IF NOT EXISTS idx_dev_db_snapshots_created_at ON public.dev_db_snapshots (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_db_snapshots_created_by ON public.dev_db_snapshots (created_by);