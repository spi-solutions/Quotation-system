-- Optional DEMO catalog (small grid). For production-like data from your old Supabase:
--   1) Set EXPORT_SOURCE_DATABASE_URL to the OLD project DB URL in .env.local
--   2) npm run export:catalog  → writes supabase/seeds/catalog_from_source.sql
--   3) Run that SQL on the NEW project (after handover). Then run supabase/sql/fresh_transactional_reset.sql
--      if any quotes/customers/users were copied by mistake.
--
-- Or rely on Supabase migration order: this runs after 20260429183000.

BEGIN;

-- Master dimensions (fixed ids 1–5 / 1–4)
INSERT INTO public.fabric_groups (id, group_number) VALUES
  (1, 1),
  (2, 2),
  (3, 3)
ON CONFLICT (id) DO UPDATE SET group_number = EXCLUDED.group_number;

INSERT INTO public.widths (id, width_value) VALUES
  (1, 600),
  (2, 900),
  (3, 1200),
  (4, 1500),
  (5, 1800)
ON CONFLICT (id) DO UPDATE SET width_value = EXCLUDED.width_value;

INSERT INTO public.drops (id, drop_value) VALUES
  (1, 1200),
  (2, 1500),
  (3, 1800),
  (4, 2100)
ON CONFLICT (id) DO UPDATE SET drop_value = EXCLUDED.drop_value;

-- Products (roller; no curtain lines)
INSERT INTO public.products (id, name, pricing_type) VALUES
  (1, 'Roller blind – blockout', 'roller'),
  (2, 'Roller blind – light filter', 'roller')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  pricing_type = EXCLUDED.pricing_type;

-- Remove prior seed grid / rules for the same ids so re-run does not duplicate rows
DELETE FROM public.roller_pricing_grid
WHERE fabric_group_id IN (1, 2, 3)
  AND width_id BETWEEN 1 AND 5
  AND drop_id BETWEEN 1 AND 4;

DELETE FROM public.costing_rules
WHERE product_id IN (1, 2);

-- One base price per fabric × width × drop (demo amounts)
INSERT INTO public.roller_pricing_grid (fabric_group_id, width_id, drop_id, base_price)
SELECT
  f.id AS fabric_group_id,
  w.id AS width_id,
  d.id AS drop_id,
  (
    280.00
    + (f.id * 18.00)
    + (w.id * 14.00)
    + (d.id * 10.00)
  )::NUMERIC(12, 2) AS base_price
FROM public.fabric_groups f
CROSS JOIN public.widths w
CROSS JOIN public.drops d
WHERE f.id IN (1, 2, 3)
  AND w.id BETWEEN 1 AND 5
  AND d.id BETWEEN 1 AND 4;

-- Costing rules (GST rows are ignored by pricingService; still useful for admin UI defaults)
INSERT INTO public.costing_rules (product_id, rule_name, rule_type, value) VALUES
  (1, 'GST', 'percentage', 10),
  (1, 'Installation', 'fixed', 0),
  (1, 'Delivery', 'fixed', 0),
  (2, 'GST', 'percentage', 10),
  (2, 'Installation', 'fixed', 0),
  (2, 'Delivery', 'fixed', 0);

-- Keep sequences aligned with explicit ids
SELECT setval(
  pg_get_serial_sequence('public.fabric_groups', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM public.fabric_groups)
);
SELECT setval(
  pg_get_serial_sequence('public.widths', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM public.widths)
);
SELECT setval(
  pg_get_serial_sequence('public.drops', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM public.drops)
);
SELECT setval(
  pg_get_serial_sequence('public.products', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM public.products)
);
SELECT setval(
  pg_get_serial_sequence('public.roller_pricing_grid', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM public.roller_pricing_grid)
);
SELECT setval(
  pg_get_serial_sequence('public.costing_rules', 'id'),
  (SELECT COALESCE(MAX(id), 1) FROM public.costing_rules)
);

COMMIT;
