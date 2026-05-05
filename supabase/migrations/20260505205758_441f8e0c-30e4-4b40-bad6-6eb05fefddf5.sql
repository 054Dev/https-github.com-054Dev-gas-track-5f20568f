
-- RPC: customer adds an order's bill to their own arrears (called after place-order succeeds)
CREATE OR REPLACE FUNCTION public.customer_add_to_arrears(_customer_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  UPDATE public.customers
  SET arrears_balance = COALESCE(arrears_balance, 0) + _amount
  WHERE id = _customer_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.customer_add_to_arrears(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_add_to_arrears(uuid, numeric) TO authenticated;

-- RPC: customer reverts (deletes) their own pending delivery and refunds the bill
CREATE OR REPLACE FUNCTION public.customer_revert_pending_delivery(_delivery_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.customers
  SET arrears_balance = COALESCE(arrears_balance, 0) - COALESCE(d_charge, 0)
  WHERE id = d_customer;

  DELETE FROM public.deliveries WHERE id = _delivery_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.customer_revert_pending_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_revert_pending_delivery(uuid) TO authenticated;
