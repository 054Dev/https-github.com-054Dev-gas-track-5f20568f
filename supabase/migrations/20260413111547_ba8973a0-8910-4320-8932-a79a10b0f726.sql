-- Add unique constraint on profiles.username
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Add unique constraint on customers.username
ALTER TABLE public.customers ADD CONSTRAINT customers_username_unique UNIQUE (username);