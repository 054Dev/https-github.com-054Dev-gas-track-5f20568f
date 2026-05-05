-- Fix privilege escalation: remove unconditional co_admin branch
DROP POLICY IF EXISTS "Allow initial admin creation" ON public.user_roles;
CREATE POLICY "Allow initial admin creation"
ON public.user_roles FOR INSERT
WITH CHECK (
  role = 'admin'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role)
);

-- Restrict receipt_template_settings reads to authenticated users
DROP POLICY IF EXISTS "Everyone can view receipt template settings" ON public.receipt_template_settings;
CREATE POLICY "Authenticated users can view receipt template settings"
ON public.receipt_template_settings FOR SELECT
TO authenticated
USING (true);

-- OTP rate limiting: track attempts per OTP record
ALTER TABLE public.admin_otps
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;