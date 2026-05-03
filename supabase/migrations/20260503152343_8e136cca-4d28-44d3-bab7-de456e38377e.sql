CREATE OR REPLACE FUNCTION public.phone_local_digits(input_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN input_phone IS NULL THEN NULL
    ELSE right(regexp_replace(input_phone, '\D', '', 'g'), 9)
  END
$$;

CREATE OR REPLACE FUNCTION public.enforce_phone_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_phone text;
  current_owner uuid;
  conflict_exists boolean := false;
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  normalized_phone := public.phone_local_digits(NEW.phone);

  IF normalized_phone IS NULL OR length(normalized_phone) <> 9 THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    current_owner := NEW.id;

    SELECT (
      EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id <> NEW.id
          AND public.phone_local_digits(p.phone) = normalized_phone
      )
      OR EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.deleted_at IS NULL
          AND coalesce(c.user_id, c.id) <> current_owner
          AND public.phone_local_digits(c.phone) = normalized_phone
      )
    ) INTO conflict_exists;

  ELSIF TG_TABLE_NAME = 'customers' THEN
    current_owner := coalesce(NEW.user_id, NEW.id);

    SELECT (
      EXISTS (
        SELECT 1
        FROM public.customers c
        WHERE c.id <> NEW.id
          AND c.deleted_at IS NULL
          AND coalesce(c.user_id, c.id) <> current_owner
          AND public.phone_local_digits(c.phone) = normalized_phone
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id <> current_owner
          AND public.phone_local_digits(p.phone) = normalized_phone
      )
    ) INTO conflict_exists;
  END IF;

  IF conflict_exists THEN
    RAISE EXCEPTION 'Phone number already in use by another account';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profiles_phone_uniqueness ON public.profiles;
CREATE TRIGGER enforce_profiles_phone_uniqueness
BEFORE INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_phone_uniqueness();

DROP TRIGGER IF EXISTS enforce_customers_phone_uniqueness ON public.customers;
CREATE TRIGGER enforce_customers_phone_uniqueness
BEFORE INSERT OR UPDATE OF phone ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_phone_uniqueness();

CREATE INDEX IF NOT EXISTS idx_profiles_phone_local_digits
ON public.profiles ((public.phone_local_digits(phone)))
WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_phone_local_digits
ON public.customers ((public.phone_local_digits(phone)))
WHERE phone IS NOT NULL AND deleted_at IS NULL;