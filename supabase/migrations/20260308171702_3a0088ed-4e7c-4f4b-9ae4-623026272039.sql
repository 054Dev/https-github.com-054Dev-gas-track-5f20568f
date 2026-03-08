
-- 1. New customer registered → notify admin
CREATE OR REPLACE FUNCTION public.notify_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (customer_id, type, message, status)
  VALUES (
    NEW.id,
    'new_customer',
    'New customer registered: ' || NEW.shop_name || ' (In-charge: ' || NEW.in_charge_name || ', Phone: ' || NEW.phone || ')',
    'pending'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_customer
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_customer();

-- 2. New delivery created → notify relevant party
CREATE OR REPLACE FUNCTION public.notify_new_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_staff boolean;
  customer_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.logged_by_user_id
    AND role IN ('admin', 'co_admin', 'staff')
  ) INTO is_staff;

  SELECT shop_name INTO customer_name
  FROM public.customers WHERE id = NEW.customer_id;

  IF is_staff THEN
    -- Admin/staff created delivery → notify customer
    INSERT INTO public.notifications (customer_id, type, message, status)
    VALUES (
      NEW.customer_id,
      'order_created',
      'A new delivery of ' || NEW.total_kg || ' kg has been created for you. Total charge: KES ' || NEW.total_charge,
      'pending'
    );
  ELSE
    -- Customer placed order → notify admin
    INSERT INTO public.notifications (customer_id, type, message, status)
    VALUES (
      NEW.customer_id,
      'new_order',
      'New order from ' || COALESCE(customer_name, 'Unknown') || ': ' || NEW.total_kg || ' kg, Total: KES ' || NEW.total_charge,
      'pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_delivery
  AFTER INSERT ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_delivery();

-- 3. Delivery status changed → notify customer
CREATE OR REPLACE FUNCTION public.notify_delivery_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  status_label text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'en_route' THEN status_label := 'is now en route to you';
    WHEN 'delivered' THEN status_label := 'has been delivered successfully';
    ELSE status_label := 'status has been updated to ' || NEW.status;
  END CASE;

  INSERT INTO public.notifications (customer_id, type, message, status)
  VALUES (
    NEW.customer_id,
    'delivery_status_update',
    'Your delivery of ' || NEW.total_kg || ' kg ' || status_label || '.',
    'pending'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_delivery_status_change();

-- 4. Payment recorded → notify customer
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (customer_id, type, message, status)
  VALUES (
    NEW.customer_id,
    'payment_received',
    'Payment of KES ' || NEW.amount_paid || ' has been recorded via ' || NEW.method || '.',
    'pending'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_received
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();
