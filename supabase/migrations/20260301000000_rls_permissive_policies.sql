-- RLS: Enable on all app tables with permissive policies.
-- Access control is enforced in the app: require login and admin role for
-- create/update/delete (API returns 403 "Admin access required" when not admin).
-- This migration only ensures RLS is on and policies exist so queries are not blocked.

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_customers" ON public.customers
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_products" ON public.products
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fabric_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_fabric_groups" ON public.fabric_groups
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.widths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_widths" ON public.widths
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_drops" ON public.drops
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.roller_pricing_grid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_roller_pricing_grid" ON public.roller_pricing_grid
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.costing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_costing_rules" ON public.costing_rules
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_quotes" ON public.quotes
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_quote_items" ON public.quote_items
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_users" ON public.users
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_all_profiles" ON public.profiles
  FOR ALL USING (true) WITH CHECK (true);
