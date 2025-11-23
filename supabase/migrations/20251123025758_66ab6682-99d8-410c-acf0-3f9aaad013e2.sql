-- Fix infinite recursion in user_roles RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

-- Create new policy using the security definer function to avoid recursion
CREATE POLICY "Admins can manage user roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'co_admin'));

-- Allow initial admin creation when no admins exist (for setup page)
CREATE POLICY "Allow initial admin creation"
ON public.user_roles
FOR INSERT
WITH CHECK (
  role = 'admin' AND
  NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role IN ('admin', 'co_admin')
  )
);

-- Allow users to view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Fix profiles table RLS to allow more operations
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'co_admin'));

CREATE POLICY "Allow profile creation on signup"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);