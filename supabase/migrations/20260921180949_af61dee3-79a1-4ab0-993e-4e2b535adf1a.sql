CREATE OR REPLACE FUNCTION public.protect_customer_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_staff boolean;
BEGIN
  -- Allow trusted SECURITY DEFINER routines (which set this flag) to adjust balances
  IF coalesce(current_setting('app.trusted_balance_update', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.customer_add_to_arrears(_customer_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.customers WHERE id = _customer_id;
  IF owner IS NULL OR owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  PERFORM set_config('app.trusted_balance_update', 'on', true);
  UPDATE public.customers
  SET arrears_balance = COALESCE(arrears_balance, 0) + _amount
  WHERE id = _customer_id;
  PERFORM set_config('app.trusted_balance_update', 'off', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.customer_revert_pending_delivery(_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d_customer uuid;
  d_owner uuid;
  d_charge numeric;
  d_status delivery_status;
BEGIN
  SELECT customer_id, total_charge, status
    INTO d_customer, d_charge, d_status
  FROM public.deliveries WHERE id = _delivery_id;

  IF d_customer IS NULL THEN
    RAISE EXCEPTION 'Delivery not found';
  END IF;

  SELECT user_id INTO d_owner FROM public.customers WHERE id = d_customer;
  IF d_owner IS NULL OR d_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF d_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending deliveries can be reverted';
  END IF;

  PERFORM set_config('app.trusted_balance_update', 'on', true);
  UPDATE public.customers
  SET arrears_balance = COALESCE(arrears_balance, 0) - COALESCE(d_charge, 0)
  WHERE id = d_customer;
  PERFORM set_config('app.trusted_balance_update', 'off', true);

  DELETE FROM public.deliveries WHERE id = _delivery_id;
END;
$function$;