-- Allow customers to create their own deliveries
CREATE POLICY "Customers can create own deliveries"
ON public.deliveries
FOR INSERT
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);