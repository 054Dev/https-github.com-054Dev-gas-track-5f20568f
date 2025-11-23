-- This migration should be run manually to create the default admin
-- Note: You'll need to create the admin user through Supabase Auth first, then run this

-- Instructions:
-- 1. First, manually create an admin user via the Setup page at /setup
--    OR use Supabase dashboard to create a user with email: admin@finegas.com
-- 2. The default password should be: FineGas2024!
-- 3. After the user signs up, this will create their profile and role

-- For now, let's create a function that admins can use to reset to default credentials
CREATE OR REPLACE FUNCTION reset_admin_password(admin_email text, new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function allows resetting admin password
  -- Only callable by existing admins
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  
  -- Note: Actual password reset must be done through Supabase Auth API
  RAISE NOTICE 'Password reset requested for %', admin_email;
END;
$$;