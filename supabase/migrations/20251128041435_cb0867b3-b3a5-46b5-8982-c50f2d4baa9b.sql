-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow initial admin creation" ON public.user_roles;

-- Create new policy that allows only one admin but multiple co_admins
CREATE POLICY "Allow initial admin creation" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  -- Allow admin role only if no admin exists yet
  (role = 'admin'::app_role AND NOT EXISTS (
    SELECT 1 FROM user_roles WHERE role = 'admin'::app_role
  ))
  OR
  -- Allow co_admin role anytime (multiple co_admins allowed)
  (role = 'co_admin'::app_role)
);