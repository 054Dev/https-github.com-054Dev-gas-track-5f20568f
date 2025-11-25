-- Fix RLS policies to allow admin operations

-- 1. Allow admins to insert profiles for new users
CREATE POLICY "Admins can create profiles for users"
ON public.profiles
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'co_admin')
);

-- 2. Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'co_admin')
);

-- 3. Allow admins and staff to view all customers
CREATE POLICY "Admins and staff can view all customers"
ON public.customers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);

-- 4. Allow customers to insert notifications (for contact admin feature)
CREATE POLICY "Customers can create notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE user_id = auth.uid()
  )
);

-- 5. Allow admins/staff to view and manage notifications
CREATE POLICY "Admins can manage notifications"
ON public.notifications
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);

-- 6. Add RLS policies for delivery_items (required for order tracking)
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage delivery items"
ON public.delivery_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);

CREATE POLICY "Customers can view own delivery items"
ON public.delivery_items
FOR SELECT
USING (
  delivery_id IN (
    SELECT d.id FROM deliveries d
    JOIN customers c ON d.customer_id = c.id
    WHERE c.user_id = auth.uid()
  )
);

-- 7. Allow staff to create deliveries
CREATE POLICY "Staff can create deliveries"
ON public.deliveries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);

-- 8. Allow staff to view and update deliveries
CREATE POLICY "Staff can manage deliveries"
ON public.deliveries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);