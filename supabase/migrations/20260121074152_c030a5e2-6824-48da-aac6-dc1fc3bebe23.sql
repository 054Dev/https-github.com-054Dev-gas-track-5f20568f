-- 1) Add explicit deny-all policies to satisfy linter while keeping table inaccessible from client
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='dev_db_snapshots' AND policyname='Deny all access to snapshots'
  ) THEN
    CREATE POLICY "Deny all access to snapshots"
    ON public.dev_db_snapshots
    FOR ALL
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;

-- 2) Fix search_path mutable warning for update_updated_at_column()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;