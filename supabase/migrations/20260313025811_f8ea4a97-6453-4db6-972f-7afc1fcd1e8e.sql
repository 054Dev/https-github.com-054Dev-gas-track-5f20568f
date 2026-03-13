
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL DEFAULT 'client',
  message text NOT NULL,
  stack_trace text,
  metadata jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolution_notes text,
  resolved_at timestamptz,
  source text
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- No public access - only edge functions with service role can insert
-- Dev page reads via edge function too
CREATE POLICY "No direct access to error_logs"
ON public.error_logs FOR ALL TO public
USING (false) WITH CHECK (false);
