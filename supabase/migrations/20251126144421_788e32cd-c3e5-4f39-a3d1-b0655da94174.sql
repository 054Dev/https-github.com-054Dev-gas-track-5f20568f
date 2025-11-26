-- Add INSERT policy for customers to create delivery items for their own deliveries
CREATE POLICY "Customers can create own delivery items"
ON public.delivery_items
FOR INSERT
WITH CHECK (
  delivery_id IN (
    SELECT d.id
    FROM deliveries d
    JOIN customers c ON d.customer_id = c.id
    WHERE c.user_id = auth.uid()
  )
);