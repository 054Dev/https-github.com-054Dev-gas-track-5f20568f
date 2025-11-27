CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'co_admin',
    'staff',
    'customer'
);


--
-- Name: delivery_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_status AS ENUM (
    'pending',
    'en_route',
    'delivered'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;


--
-- Name: reset_admin_password(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_admin_password(admin_email text, new_password text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- This function allows resetting admin password
  -- Only callable by existing admins
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reset passwords';
  END IF;
  
  -- Note: Actual password reset must be done through Supabase Auth API
  RAISE NOTICE 'Password reset requested for %', admin_email;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: admin_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    phone character varying,
    otp character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    username character varying NOT NULL,
    shop_name character varying NOT NULL,
    in_charge_name character varying NOT NULL,
    email character varying,
    phone character varying NOT NULL,
    address text,
    price_per_kg numeric(10,2) NOT NULL,
    arrears_balance numeric(12,2) DEFAULT 0,
    status character varying DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- Name: cylinder_capacities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cylinder_capacities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    capacity_kg numeric NOT NULL
);


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    logged_by_user_id uuid NOT NULL,
    delivery_date timestamp with time zone DEFAULT now(),
    total_kg numeric NOT NULL,
    price_per_kg_at_time numeric(10,2) NOT NULL,
    total_charge numeric(12,2) NOT NULL,
    manual_adjustment numeric(12,2) DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    status public.delivery_status DEFAULT 'pending'::public.delivery_status NOT NULL
);


--
-- Name: delivery_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_id uuid NOT NULL,
    cylinder_capacity_id uuid NOT NULL,
    quantity integer NOT NULL,
    kg_contribution numeric NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    type character varying NOT NULL,
    message text NOT NULL,
    sent_at timestamp with time zone,
    status character varying DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_id uuid,
    customer_id uuid NOT NULL,
    amount_paid numeric(12,2) NOT NULL,
    method character varying NOT NULL,
    reference character varying,
    paid_at timestamp with time zone DEFAULT now(),
    handled_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username character varying NOT NULL,
    full_name character varying NOT NULL,
    phone character varying,
    profile_pic_url character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    delivery_id uuid,
    payment_id uuid,
    file_url character varying,
    filename character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    unit character varying DEFAULT 'kg'::character varying NOT NULL,
    image_url character varying,
    status character varying DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_otps admin_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_otps
    ADD CONSTRAINT admin_otps_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_key UNIQUE (user_id);


--
-- Name: customers customers_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_username_key UNIQUE (username);


--
-- Name: cylinder_capacities cylinder_capacities_capacity_kg_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cylinder_capacities
    ADD CONSTRAINT cylinder_capacities_capacity_kg_key UNIQUE (capacity_kg);


--
-- Name: cylinder_capacities cylinder_capacities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cylinder_capacities
    ADD CONSTRAINT cylinder_capacities_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: delivery_items delivery_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_items
    ADD CONSTRAINT delivery_items_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: receipts receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: idx_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_status ON public.deliveries USING btree (status);


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deliveries update_deliveries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_deliveries_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: services update_services_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_logged_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_logged_by_user_id_fkey FOREIGN KEY (logged_by_user_id) REFERENCES auth.users(id);


--
-- Name: delivery_items delivery_items_cylinder_capacity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_items
    ADD CONSTRAINT delivery_items_cylinder_capacity_id_fkey FOREIGN KEY (cylinder_capacity_id) REFERENCES public.cylinder_capacities(id);


--
-- Name: delivery_items delivery_items_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_items
    ADD CONSTRAINT delivery_items_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: payments payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: payments payments_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;


--
-- Name: payments payments_handled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_handled_by_fkey FOREIGN KEY (handled_by) REFERENCES auth.users(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: receipts receipts_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id) ON DELETE SET NULL;


--
-- Name: receipts receipts_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receipts
    ADD CONSTRAINT receipts_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: customers Admins and staff can update customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and staff can update customers" ON public.customers FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role, 'staff'::public.app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role, 'staff'::public.app_role]))))));


--
-- Name: customers Admins and staff can view all customers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and staff can view all customers" ON public.customers FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role, 'staff'::public.app_role]))))));


--
-- Name: profiles Admins can create profiles for users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create profiles for users" ON public.profiles FOR INSERT WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'co_admin'::public.app_role)));


--
-- Name: admin_otps Admins can manage OTPs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage OTPs" ON public.admin_otps USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'co_admin'::public.app_role)));


--
-- Name: notifications Admins can manage notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage notifications" ON public.notifications USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role, 'staff'::public.app_role]))))));


--
-- Name: services Admins can manage services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage services" ON public.services USING ((EXISTS ( SELECT 1
   FROM public.user_roles ur
  WHERE ((ur.user_id = auth.uid()) AND (ur.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role]))))));


--
-- Name: user_roles Admins can manage user roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage user roles" ON public.user_roles USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'co_admin'::public.app_role)));


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'co_admin'::public.app_role)));


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'co_admin'::public.app_role)));


--
-- Name: admin_otps Allow OTP creation for initial setup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow OTP creation for initial setup" ON public.admin_otps FOR INSERT WITH CHECK ((NOT (EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role]))))));


--
-- Name: user_roles Allow initial admin creation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow initial admin creation" ON public.user_roles FOR INSERT WITH CHECK (((role = 'admin'::public.app_role) AND (NOT (EXISTS ( SELECT 1
   FROM public.user_roles user_roles_1
  WHERE (user_roles_1.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role])))))));


--
-- Name: profiles Allow profile creation on signup; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow profile creation on signup" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: admin_otps Anyone can verify OTP; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can verify OTP" ON public.admin_otps FOR SELECT USING (true);


--
-- Name: notifications Customers can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create notifications" ON public.notifications FOR INSERT WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: deliveries Customers can create own deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create own deliveries" ON public.deliveries FOR INSERT WITH CHECK ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: delivery_items Customers can create own delivery items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create own delivery items" ON public.delivery_items FOR INSERT WITH CHECK ((delivery_id IN ( SELECT d.id
   FROM (public.deliveries d
     JOIN public.customers c ON ((d.customer_id = c.id)))
  WHERE (c.user_id = auth.uid()))));


--
-- Name: customers Customers can create own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create own record" ON public.customers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: deliveries Customers can delete own pending deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete own pending deliveries" ON public.deliveries FOR DELETE USING (((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))) AND (status = 'pending'::public.delivery_status)));


--
-- Name: customers Customers can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update own profile" ON public.customers FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: customers Customers can view own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own data" ON public.customers FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: deliveries Customers can view own deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own deliveries" ON public.deliveries FOR SELECT TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: delivery_items Customers can view own delivery items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own delivery items" ON public.delivery_items FOR SELECT USING ((delivery_id IN ( SELECT d.id
   FROM (public.deliveries d
     JOIN public.customers c ON ((d.customer_id = c.id)))
  WHERE (c.user_id = auth.uid()))));


--
-- Name: notifications Customers can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own notifications" ON public.notifications FOR SELECT TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: payments Customers can view own payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own payments" ON public.payments FOR SELECT TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: receipts Customers can view own receipts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view own receipts" ON public.receipts FOR SELECT TO authenticated USING ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE (customers.user_id = auth.uid()))));


--
-- Name: services Everyone can view active services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view active services" ON public.services FOR SELECT USING ((((status)::text = 'active'::text) AND (deleted_at IS NULL)));


--
-- Name: cylinder_capacities Everyone can view cylinder capacities; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Everyone can view cylinder capacities" ON public.cylinder_capacities FOR SELECT TO authenticated USING (true);


--
-- Name: deliveries Staff can create deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can create deliveries" ON public.deliveries FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role, 'staff'::public.app_role]))))));


--
-- Name: deliveries Staff can manage deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage deliveries" ON public.deliveries USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role, 'staff'::public.app_role]))))));


--
-- Name: delivery_items Staff can manage delivery items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Staff can manage delivery items" ON public.delivery_items USING ((EXISTS ( SELECT 1
   FROM public.user_roles
  WHERE ((user_roles.user_id = auth.uid()) AND (user_roles.role = ANY (ARRAY['admin'::public.app_role, 'co_admin'::public.app_role, 'staff'::public.app_role]))))));


--
-- Name: user_roles Users can create own customer role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own customer role" ON public.user_roles FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (role = 'customer'::public.app_role)));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_otps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_otps ENABLE ROW LEVEL SECURITY;

--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: cylinder_capacities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cylinder_capacities ENABLE ROW LEVEL SECURITY;

--
-- Name: deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


