
-- 1) Protect customers INSERT for non-staff
CREATE OR REPLACE FUNCTION public.protect_customer_insert()
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

  -- Force safe defaults; ignore any client-provided values for sensitive fields
  NEW.price_per_kg := 150;
  NEW.arrears_balance := 0;
  NEW.status := 'active';
  NEW.user_id := auth.uid();
  NEW.deleted_at := NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_customer_insert ON public.customers;
CREATE TRIGGER trg_protect_customer_insert
BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.protect_customer_insert();

-- 2) Protect deliveries INSERT for non-staff
CREATE OR REPLACE FUNCTION public.protect_delivery_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
  cust_price numeric;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'co_admin'::app_role, 'staff'::app_role)
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Verify customer ownership
  SELECT price_per_kg INTO cust_price
  FROM public.customers
  WHERE id = NEW.customer_id AND user_id = auth.uid();

  IF cust_price IS NULL THEN
    RAISE EXCEPTION 'Not authorized to create delivery for this customer';
  END IF;

  NEW.logged_by_user_id := auth.uid();
  NEW.price_per_kg_at_time := cust_price;
  NEW.manual_adjustment := 0;
  NEW.status := 'pending';
  IF NEW.total_kg IS NULL OR NEW.total_kg < 0 THEN
    RAISE EXCEPTION 'Invalid total_kg';
  END IF;
  NEW.total_charge := COALESCE(NEW.total_kg, 0) * cust_price;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_delivery_insert ON public.deliveries;
CREATE TRIGGER trg_protect_delivery_insert
BEFORE INSERT ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.protect_delivery_insert();

-- 3) Protect delivery_items INSERT for non-staff
CREATE OR REPLACE FUNCTION public.protect_delivery_items_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
  cap_kg numeric;
  owner uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'co_admin'::app_role, 'staff'::app_role)
  ) INTO is_staff;

  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Verify ownership of parent delivery
  SELECT c.user_id INTO owner
  FROM public.deliveries d
  JOIN public.customers c ON c.id = d.customer_id
  WHERE d.id = NEW.delivery_id;

  IF owner IS NULL OR owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to add items to this delivery';
  END IF;

  SELECT capacity_kg INTO cap_kg
  FROM public.cylinder_capacities
  WHERE id = NEW.cylinder_capacity_id;

  IF cap_kg IS NULL THEN
    RAISE EXCEPTION 'Invalid cylinder capacity';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity';
  END IF;

  -- Force the kg contribution to match capacity * quantity
  NEW.kg_contribution := cap_kg * NEW.quantity;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_delivery_items_insert ON public.delivery_items;
CREATE TRIGGER trg_protect_delivery_items_insert
BEFORE INSERT ON public.delivery_items
FOR EACH ROW EXECUTE FUNCTION public.protect_delivery_items_insert();
