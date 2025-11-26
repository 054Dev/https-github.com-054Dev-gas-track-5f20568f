-- Create enum for delivery status
CREATE TYPE public.delivery_status AS ENUM ('pending', 'en_route', 'delivered');

-- Add status column to deliveries table
ALTER TABLE public.deliveries 
ADD COLUMN status public.delivery_status NOT NULL DEFAULT 'pending';

-- Add policy for customers to delete their own pending deliveries
CREATE POLICY "Customers can delete own pending deliveries"
ON public.deliveries
FOR DELETE
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
  AND status = 'pending'
);

-- Create index for better performance on status queries
CREATE INDEX idx_deliveries_status ON public.deliveries(status);