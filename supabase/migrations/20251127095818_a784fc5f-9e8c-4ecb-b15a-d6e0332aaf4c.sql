-- Fix RLS policies for payments table
DROP POLICY IF EXISTS "Customers can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can manage payments" ON public.payments;

-- Allow customers to view their own payments
CREATE POLICY "Customers can view own payments"
ON public.payments
FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- Allow staff/admin to manage all payments
CREATE POLICY "Staff can manage all payments"
ON public.payments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);

-- Add payment_method and payment_status columns if not present
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'manual';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'completed';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Fix RLS on receipts table
DROP POLICY IF EXISTS "Customers can view own receipts" ON public.receipts;
DROP POLICY IF EXISTS "Staff can manage receipts" ON public.receipts;

-- Allow customers to view their own receipts
CREATE POLICY "Customers can view own receipts"
ON public.receipts
FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- Allow staff/admin to manage all receipts
CREATE POLICY "Staff can manage all receipts"
ON public.receipts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);