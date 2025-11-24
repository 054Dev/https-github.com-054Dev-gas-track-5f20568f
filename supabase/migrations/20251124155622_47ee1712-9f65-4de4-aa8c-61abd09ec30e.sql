-- Allow users to create their own customer role during signup
CREATE POLICY "Users can create own customer role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND role = 'customer'
);