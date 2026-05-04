-- Handover cleanup migration:
-- Keep schema + catalog/master data, remove transactional/customer data.
-- Preserves admin users only.

BEGIN;

-- Remove sensitive integration/runtime tokens.
DELETE FROM public.password_reset_tokens;
DELETE FROM public.xero_tokens;

-- Remove quote transactional data.
DELETE FROM public.quote_items;
DELETE FROM public.quotes;
DELETE FROM public.customers;

-- Keep admin users/profiles only.
DELETE FROM public.profiles
WHERE role <> 'admin'
   OR auth_user_id NOT IN (
     SELECT id::text
     FROM public.users
     WHERE role = 'admin'
   );

DELETE FROM public.users
WHERE role <> 'admin';

-- Normalize sequences after cleanup.
SELECT setval(
  'public.customers_id_seq',
  COALESCE((SELECT MAX(id) FROM public.customers), 0) + 1,
  false
);
SELECT setval(
  'public.quotes_id_seq',
  COALESCE((SELECT MAX(id) FROM public.quotes), 0) + 1,
  false
);
SELECT setval(
  'public.quote_items_id_seq',
  COALESCE((SELECT MAX(id) FROM public.quote_items), 0) + 1,
  false
);
SELECT setval(
  'public.password_reset_tokens_id_seq',
  COALESCE((SELECT MAX(id) FROM public.password_reset_tokens), 0) + 1,
  false
);
SELECT setval(
  'public.users_id_seq',
  COALESCE((SELECT MAX(id) FROM public.users), 0) + 1,
  false
);
SELECT setval(
  'public.profiles_id_seq',
  COALESCE((SELECT MAX(id) FROM public.profiles), 0) + 1,
  false
);

COMMIT;
