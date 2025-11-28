-- Create deletion_requests table for customers to request account deletion
CREATE TABLE public.deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  handled_by UUID REFERENCES auth.users(id),
  handled_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create their own deletion request
CREATE POLICY "Users can create own deletion request"
ON public.deletion_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own deletion requests
CREATE POLICY "Users can view own deletion requests"
ON public.deletion_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can view all deletion requests
CREATE POLICY "Admins can view all deletion requests"
ON public.deletion_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);

-- Policy: Admins can update deletion requests
CREATE POLICY "Admins can update deletion requests"
ON public.deletion_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'co_admin', 'staff')
  )
);

-- Add index for faster lookups
CREATE INDEX idx_deletion_requests_status ON public.deletion_requests(status);
CREATE INDEX idx_deletion_requests_user_id ON public.deletion_requests(user_id);