-- Base schema and all tables in the PUBLIC schema.
-- Run this first (e.g. in Supabase SQL Editor or via psql).
-- Then run: 20260227100000_app_users.sql (which also now targets public.users).

-- Customers (no FKs)
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Products (no FKs)
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pricing_type TEXT NOT NULL DEFAULT 'roller'
);

-- Fabric groups, widths, drops (no FKs)
CREATE TABLE IF NOT EXISTS public.fabric_groups (
  id BIGSERIAL PRIMARY KEY,
  group_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.widths (
  id BIGSERIAL PRIMARY KEY,
  width_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS public.drops (
  id BIGSERIAL PRIMARY KEY,
  drop_value INTEGER NOT NULL
);

-- Roller pricing grid (fabric_group + width + drop → base_price)
CREATE TABLE IF NOT EXISTS public.roller_pricing_grid (
  id BIGSERIAL PRIMARY KEY,
  fabric_group_id BIGINT NOT NULL REFERENCES public.fabric_groups(id),
  width_id BIGINT NOT NULL REFERENCES public.widths(id),
  drop_id BIGINT NOT NULL REFERENCES public.drops(id),
  base_price NUMERIC(12,2) NOT NULL
);

-- Costing rules per product
CREATE TABLE IF NOT EXISTS public.costing_rules (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES public.products(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quotes (
  id BIGSERIAL PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id),
  product_id BIGINT NOT NULL REFERENCES public.products(id),
  fabric_group_id BIGINT NOT NULL REFERENCES public.fabric_groups(id),
  input_width INTEGER NOT NULL,
  input_drop INTEGER NOT NULL,
  rounded_width_id BIGINT NOT NULL REFERENCES public.widths(id),
  rounded_drop_id BIGINT NOT NULL REFERENCES public.drops(id),
  base_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  gst NUMERIC(12,2) NOT NULL,
  final_total NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Approved','Invoiced')),
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  additional_info TEXT
);

-- Quote items (per-product lines for a quote)
CREATE TABLE IF NOT EXISTS public.quote_items (
  id BIGSERIAL PRIMARY KEY,
  quote_id BIGINT NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products(id),
  fabric_group_id BIGINT NOT NULL REFERENCES public.fabric_groups(id),
  input_width INTEGER NOT NULL,
  input_drop INTEGER NOT NULL,
  rounded_width_id BIGINT NOT NULL REFERENCES public.widths(id),
  rounded_drop_id BIGINT NOT NULL REFERENCES public.drops(id),
  base_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  gst NUMERIC(12,2) NOT NULL,
  final_total NUMERIC(12,2) NOT NULL,
  location_label TEXT NOT NULL,
  location_other TEXT
);

-- Auth users (email + password, no Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Profile per user (auth_user_id = users.id as TEXT)
CREATE TABLE IF NOT EXISTS public.profiles (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  -- Public schema (what the app uses)
  IF to_regclass('public.products') IS NOT NULL
     AND to_regclass('public.products_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.products_id_seq',
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.products),
      false
    );
  END IF;

  IF to_regclass('public.fabric_groups') IS NOT NULL
     AND to_regclass('public.fabric_groups_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.fabric_groups_id_seq',
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.fabric_groups),
      false
    );
  END IF;

  IF to_regclass('public.widths') IS NOT NULL
     AND to_regclass('public.widths_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.widths_id_seq',
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.widths),
      false
    );
  END IF;

  IF to_regclass('public.drops') IS NOT NULL
     AND to_regclass('public.drops_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.drops_id_seq',
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.drops),
      false
    );
  END IF;

  IF to_regclass('public.roller_pricing_grid') IS NOT NULL
     AND to_regclass('public.roller_pricing_grid_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.roller_pricing_grid_id_seq',
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.roller_pricing_grid),
      false
    );
  END IF;

  IF to_regclass('public.costing_rules') IS NOT NULL
     AND to_regclass('public.costing_rules_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.costing_rules_id_seq',
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.costing_rules),
      false
    );
  END IF;

  IF to_regclass('public.quote_items') IS NOT NULL
     AND to_regclass('public.quote_items_id_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.quote_items_id_seq',
      (SELECT COALESCE(MAX(id), 0) + 1 FROM public.quote_items),
      false
    );
  END IF;

  -- Ensure additional_info column exists on quotes for existing databases
  IF to_regclass('public.quotes') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.quotes
        ADD COLUMN IF NOT EXISTS additional_info TEXT;
    EXCEPTION
      WHEN duplicate_column THEN
        NULL;
    END;
  END IF;

  -- Legacy app.* tables are no longer used by the app,
  -- so we intentionally do not touch their sequences here.
END
$$;
