-- Allow admins and staff to update customer records
CREATE POLICY "Admins and staff can update customers"
ON public.customers
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);