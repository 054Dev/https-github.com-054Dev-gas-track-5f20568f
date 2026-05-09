-- Remove privilege escalation policies that allowed any user to bootstrap admin/OTPs
DROP POLICY IF EXISTS "Allow initial admin creation" ON public.user_roles;
DROP POLICY IF EXISTS "Allow OTP creation for initial setup" ON public.admin_otps;