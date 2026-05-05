
-- 1) Customers: trigger preventing self-update of sensitive financial fields
CREATE OR REPLACE FUNCTION public.protect_customer_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'co_admin'::app_role, 'staff'::app_role)
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.price_per_kg IS DISTINCT FROM OLD.price_per_kg
     OR NEW.arrears_balance IS DISTINCT FROM OLD.arrears_balance
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'Not allowed to modify protected customer fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_customer_sensitive_fields_trg ON public.customers;
CREATE TRIGGER protect_customer_sensitive_fields_trg
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.protect_customer_sensitive_fields();

-- 2) Deliveries: trigger restricting customer updates to notes only
CREATE OR REPLACE FUNCTION public.protect_delivery_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'co_admin'::app_role, 'staff'::app_role)
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_charge IS DISTINCT FROM OLD.total_charge
     OR NEW.total_kg IS DISTINCT FROM OLD.total_kg
     OR NEW.price_per_kg_at_time IS DISTINCT FROM OLD.price_per_kg_at_time
     OR NEW.manual_adjustment IS DISTINCT FROM OLD.manual_adjustment
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.logged_by_user_id IS DISTINCT FROM OLD.logged_by_user_id
     OR NEW.delivery_date IS DISTINCT FROM OLD.delivery_date THEN
    RAISE EXCEPTION 'Customers can only edit notes on deliveries';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_delivery_sensitive_fields_trg ON public.deliveries;
CREATE TRIGGER protect_delivery_sensitive_fields_trg
BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.protect_delivery_sensitive_fields();

-- 3) Notifications: tighten INSERT policy to authenticated + restrict to safe values
DROP POLICY IF EXISTS "Customers can create notifications" ON public.notifications;
CREATE POLICY "Customers can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  AND status = 'pending'
  AND type IN ('customer_message','order_inquiry','support_request')
);

-- 4) admin_otps: hash OTP values at insert; reset attempts
CREATE OR REPLACE FUNCTION public.hash_admin_otp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.otp IS NULL OR length(NEW.otp) = 0 THEN
    RETURN NEW;
  END IF;
  -- Only hash if it doesn't already look like a sha256 hex digest
  IF NEW.otp !~ '^[0-9a-f]{64}$' THEN
    NEW.otp := encode(extensions.digest(NEW.otp, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP TRIGGER IF EXISTS hash_admin_otp_trg ON public.admin_otps;
CREATE TRIGGER hash_admin_otp_trg
BEFORE INSERT ON public.admin_otps
FOR EACH ROW EXECUTE FUNCTION public.hash_admin_otp();

-- Hash any existing plaintext OTPs in place (best effort; they'll just fail verification)
UPDATE public.admin_otps
SET otp = encode(extensions.digest(otp, 'sha256'), 'hex')
WHERE otp !~ '^[0-9a-f]{64}$';

-- 5) Realtime channel authorization: only allow listening on own channel
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can subscribe to own notification channel" ON realtime.messages;
CREATE POLICY "Users can subscribe to own notification channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Admin/staff can subscribe to admin channel
  (
    realtime.topic() = 'notifications-admin'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'co_admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
    )
  )
  OR
  -- Customers can subscribe to their own customer-id channel
  (
    realtime.topic() LIKE 'notifications-%'
    AND replace(realtime.topic(), 'notifications-', '') IN (
      SELECT id::text FROM public.customers WHERE user_id = auth.uid()
    )
  )
);

-- 6) Revoke EXECUTE on internal/SECURITY DEFINER functions from anon/authenticated.
--    RLS policies and triggers run with elevated privileges and don't need EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.reset_admin_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_payment_received() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_delivery_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_customer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_delivery() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_phone_uniqueness() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_customer_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_delivery_sensitive_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_admin_otp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
