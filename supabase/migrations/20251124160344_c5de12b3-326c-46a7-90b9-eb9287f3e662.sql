-- Allow users to create their own customer record during signup
CREATE POLICY "Customers can create own record"
ON public.customers
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);