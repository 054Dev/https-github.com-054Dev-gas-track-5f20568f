-- Replace phone normalization: full number, with leading 0 treated as +254
CREATE OR REPLACE FUNCTION public.phone_local_digits(input_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN input_phone IS NULL OR btrim(input_phone) = '' THEN NULL
    -- Strip non-digits, then if it starts with '0' replace that 0 with '254' (Kenya)
    WHEN regexp_replace(input_phone, '\D', '', 'g') ~ '^0' THEN
      '254' || substring(regexp_replace(input_phone, '\D', '', 'g') from 2)
    ELSE regexp_replace(input_phone, '\D', '', 'g')
  END
$function$;

-- Update trigger to use full normalized form (no fixed length check)
CREATE OR REPLACE FUNCTION public.enforce_phone_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone text;
  current_owner uuid;
  conflict_exists boolean := false;
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  normalized_phone := public.phone_local_digits(NEW.phone);

  IF normalized_phone IS NULL OR length(normalized_phone) < 8 THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    current_owner := NEW.id;

    SELECT (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id <> NEW.id
          AND public.phone_local_digits(p.phone) = normalized_phone
      )
      OR EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.deleted_at IS NULL
          AND coalesce(c.user_id, c.id) <> current_owner
          AND public.phone_local_digits(c.phone) = normalized_phone
      )
    ) INTO conflict_exists;

  ELSIF TG_TABLE_NAME = 'customers' THEN
    current_owner := coalesce(NEW.user_id, NEW.id);

    SELECT (
      EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id <> NEW.id
          AND c.deleted_at IS NULL
          AND coalesce(c.user_id, c.id) <> current_owner
          AND public.phone_local_digits(c.phone) = normalized_phone
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
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
$function$;