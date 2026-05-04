-- One-shot bootstrap + clean handover migration.
-- Intended for new client projects (or idempotent re-runs).
-- Creates full schema/policies and removes transactional data.
-- NOTE: This repository does not contain seed INSERTs for catalog tables
-- (products/fabric_groups/widths/drops/pricing/costing). Import those once
-- from your source environment if you need exact values replicated.

BEGIN;

-- Core tables
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  xero_contact_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pricing_type TEXT NOT NULL DEFAULT 'roller'
);

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

CREATE TABLE IF NOT EXISTS public.roller_pricing_grid (
  id BIGSERIAL PRIMARY KEY,
  fabric_group_id BIGINT NOT NULL REFERENCES public.fabric_groups(id),
  width_id BIGINT NOT NULL REFERENCES public.widths(id),
  drop_id BIGINT NOT NULL REFERENCES public.drops(id),
  base_price NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.costing_rules (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES public.products(id),
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  status TEXT NOT NULL DEFAULT 'Draft',
  created_by_user_id TEXT,
  additional_info TEXT,
  eta_text TEXT,
  xero_invoice_id TEXT,
  xero_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('Draft', 'EmailQueued', 'Sent', 'Approved', 'Invoiced', 'EmailFailed'));

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
  quantity INTEGER NOT NULL DEFAULT 1,
  location_label TEXT NOT NULL,
  location_other TEXT
);
ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_quantity_check;
ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_quantity_check CHECK (quantity >= 1);

CREATE TABLE IF NOT EXISTS public.xero_tokens (
  provider TEXT PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.xero_tokens DROP CONSTRAINT IF EXISTS xero_tokens_provider_check;
ALTER TABLE public.xero_tokens
  ADD CONSTRAINT xero_tokens_provider_check CHECK (provider = 'xero');

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
  ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx
  ON public.password_reset_tokens(expires_at);

-- RLS baseline
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.widths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roller_pricing_grid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Permissive app policies for non-sensitive tables
DROP POLICY IF EXISTS "app_all_customers" ON public.customers;
CREATE POLICY "app_all_customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_products" ON public.products;
CREATE POLICY "app_all_products" ON public.products FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_fabric_groups" ON public.fabric_groups;
CREATE POLICY "app_all_fabric_groups" ON public.fabric_groups FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_widths" ON public.widths;
CREATE POLICY "app_all_widths" ON public.widths FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_drops" ON public.drops;
CREATE POLICY "app_all_drops" ON public.drops FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_roller_pricing_grid" ON public.roller_pricing_grid;
CREATE POLICY "app_all_roller_pricing_grid" ON public.roller_pricing_grid FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_costing_rules" ON public.costing_rules;
CREATE POLICY "app_all_costing_rules" ON public.costing_rules FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_quotes" ON public.quotes;
CREATE POLICY "app_all_quotes" ON public.quotes FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_all_quote_items" ON public.quote_items;
CREATE POLICY "app_all_quote_items" ON public.quote_items FOR ALL USING (true) WITH CHECK (true);

-- Lock down sensitive tables
DROP POLICY IF EXISTS "app_all_users" ON public.users;
DROP POLICY IF EXISTS "users_block_api_access" ON public.users;
CREATE POLICY "users_block_api_access"
  ON public.users
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "app_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_block_api_access" ON public.profiles;
CREATE POLICY "profiles_block_api_access"
  ON public.profiles
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "xero_tokens_block_api_access" ON public.xero_tokens;
CREATE POLICY "xero_tokens_block_api_access"
  ON public.xero_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "password_reset_tokens_block_api_access" ON public.password_reset_tokens;
CREATE POLICY "password_reset_tokens_block_api_access"
  ON public.password_reset_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Clean handover data (keep admin users only).
DELETE FROM public.password_reset_tokens;
DELETE FROM public.xero_tokens;
DELETE FROM public.quote_items;
DELETE FROM public.quotes;
DELETE FROM public.customers;

DELETE FROM public.profiles
WHERE role <> 'admin'
   OR auth_user_id NOT IN (
     SELECT id::text FROM public.users WHERE role = 'admin'
   );

DELETE FROM public.users
WHERE role <> 'admin';

COMMIT;
