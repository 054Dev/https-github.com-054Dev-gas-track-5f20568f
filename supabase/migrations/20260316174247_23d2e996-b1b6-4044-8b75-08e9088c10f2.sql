
-- Allow admins to read error_logs
CREATE POLICY "Admins can view error logs"
ON public.error_logs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'co_admin')
);

-- Allow admins to read snapshots
CREATE POLICY "Admins can view snapshots"
ON public.dev_db_snapshots
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'co_admin')
);
