-- Create receipt template settings table
CREATE TABLE public.receipt_template_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'FINE GAS LIMITED',
  logo_url TEXT,
  footer_text TEXT DEFAULT 'Thank you for your business!',
  show_transaction_id BOOLEAN DEFAULT true,
  show_payment_method BOOLEAN DEFAULT true,
  custom_field_1_label TEXT,
  custom_field_1_value TEXT,
  custom_field_2_label TEXT,
  custom_field_2_value TEXT,
  custom_field_3_label TEXT,
  custom_field_3_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receipt_template_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can manage receipt template settings
CREATE POLICY "Admins can manage receipt template settings"
ON public.receipt_template_settings
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role IN ('admin', 'co_admin')
));

-- Everyone can view receipt template settings (for displaying on receipts)
CREATE POLICY "Everyone can view receipt template settings"
ON public.receipt_template_settings
FOR SELECT
USING (true);

-- Insert default settings
INSERT INTO public.receipt_template_settings (company_name, footer_text)
VALUES ('FINE GAS LIMITED', 'Thank you for your payment!');