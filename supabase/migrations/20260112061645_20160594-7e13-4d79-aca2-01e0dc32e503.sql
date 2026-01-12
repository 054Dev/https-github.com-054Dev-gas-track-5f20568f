-- Remove the insecure public SELECT policy on admin_otps table
-- This policy allows unauthenticated access to read OTP codes, emails, and phone numbers
DROP POLICY IF EXISTS "Anyone can verify OTP" ON public.admin_otps;