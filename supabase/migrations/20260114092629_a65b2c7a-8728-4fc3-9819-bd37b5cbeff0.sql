-- Add RLS policies for admins to manage cylinder_capacities
CREATE POLICY "Admins can manage cylinder capacities"
ON public.cylinder_capacities
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'co_admin')
  )
);

-- Ensure RLS is enabled on the table
ALTER TABLE public.cylinder_capacities ENABLE ROW LEVEL SECURITY;