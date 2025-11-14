-- Create app_role enum for system users
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

-- Create user_roles table for role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create profiles table for system users (admin and staff)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR UNIQUE NOT NULL,
  full_name VARCHAR NOT NULL,
  phone VARCHAR,
  profile_pic_url VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  username VARCHAR UNIQUE NOT NULL,
  shop_name VARCHAR NOT NULL,
  in_charge_name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR NOT NULL,
  address TEXT,
  price_per_kg DECIMAL(10,2) NOT NULL,
  arrears_balance DECIMAL(12,2) DEFAULT 0,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create cylinder_capacities table with seed data
CREATE TABLE public.cylinder_capacities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacity_kg DECIMAL NOT NULL UNIQUE
);

ALTER TABLE public.cylinder_capacities ENABLE ROW LEVEL SECURITY;

INSERT INTO public.cylinder_capacities (capacity_kg) VALUES
  (1), (3), (6), (7), (13), (23), (45), (50);

-- Create deliveries table
CREATE TABLE public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  logged_by_user_id UUID REFERENCES auth.users(id) NOT NULL,
  delivery_date TIMESTAMPTZ DEFAULT NOW(),
  total_kg DECIMAL NOT NULL,
  price_per_kg_at_time DECIMAL(10,2) NOT NULL,
  total_charge DECIMAL(12,2) NOT NULL,
  manual_adjustment DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

-- Create delivery_items table
CREATE TABLE public.delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE NOT NULL,
  cylinder_capacity_id UUID REFERENCES public.cylinder_capacities(id) NOT NULL,
  quantity INT NOT NULL,
  kg_contribution DECIMAL NOT NULL
);

ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  method VARCHAR NOT NULL,
  reference VARCHAR,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  handled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create receipts table
CREATE TABLE public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  file_url VARCHAR,
  filename VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create trigger function for updating updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- user_roles: Only admins can manage roles
CREATE POLICY "Admins can manage user roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles: Users can view their own, admins can view all
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- customers: Customers can view their own data, admin/staff can view all
CREATE POLICY "Customers can view own data"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin and staff can view all customers"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Admins can manage customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can update own profile"
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- cylinder_capacities: Everyone can read
CREATE POLICY "Everyone can view cylinder capacities"
  ON public.cylinder_capacities
  FOR SELECT
  TO authenticated
  USING (true);

-- deliveries: Customers can view own, admin/staff can view and manage
CREATE POLICY "Customers can view own deliveries"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin and staff can view all deliveries"
  ON public.deliveries
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Admin and staff can manage deliveries"
  ON public.deliveries
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- delivery_items: Follow deliveries access
CREATE POLICY "Users can view delivery items for accessible deliveries"
  ON public.delivery_items
  FOR SELECT
  TO authenticated
  USING (
    delivery_id IN (
      SELECT id FROM public.deliveries
      WHERE customer_id IN (
        SELECT id FROM public.customers WHERE user_id = auth.uid()
      )
    ) OR
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Admin and staff can manage delivery items"
  ON public.delivery_items
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- payments: Similar access pattern
CREATE POLICY "Customers can view own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin and staff can view all payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Admin and staff can manage payments"
  ON public.payments
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- receipts: Customers can view own, admin/staff can view all
CREATE POLICY "Customers can view own receipts"
  ON public.receipts
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin and staff can view all receipts"
  ON public.receipts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Admin and staff can manage receipts"
  ON public.receipts
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'staff')
  );

-- notifications: Customers can view own
CREATE POLICY "Customers can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage all notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();