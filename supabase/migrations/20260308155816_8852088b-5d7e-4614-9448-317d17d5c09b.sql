CREATE POLICY "Customers can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))
WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));