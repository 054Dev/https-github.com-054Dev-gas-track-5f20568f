
DROP POLICY IF EXISTS "Customers can create notifications" ON public.notifications;
CREATE POLICY "Customers can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  AND status = 'pending'
);
