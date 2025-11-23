-- Fix admin_otps RLS to allow initial setup
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage OTPs" ON public.admin_otps;
DROP POLICY IF EXISTS "Anyone can verify OTP" ON public.admin_otps;

-- Allow inserting OTPs during initial setup (when no admins exist)
CREATE POLICY "Allow OTP creation for initial setup"
ON public.admin_otps
FOR INSERT
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE role IN ('admin', 'co_admin')
  )
);

-- Allow admins to manage OTPs after setup
CREATE POLICY "Admins can manage OTPs"
ON public.admin_otps
FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'co_admin')
);

-- Allow anyone to read OTPs for verification (needed for the verification step)
CREATE POLICY "Anyone can verify OTP"
ON public.admin_otps
FOR SELECT
USING (true);