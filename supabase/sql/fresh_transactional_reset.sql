-- Run on the NEW Supabase project when you want a clean operational slate but keep catalog
-- (products, fabric_groups, widths, drops, roller_pricing_grid, costing_rules) untouched.
--
-- Clears: quotes, customers, tokens, Xero session, non-admin auth rows.
-- Matches the cleanup section of 20260429183000_full_bootstrap_clean_handover.sql
--
-- After this: reconnect Xero on the new project; have at least one admin user (signup or restore).

BEGIN;

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
