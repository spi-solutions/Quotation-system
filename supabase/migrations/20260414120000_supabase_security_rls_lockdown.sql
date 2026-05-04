-- Fix Supabase linter: rls_disabled_in_public (xero_tokens) and sensitive_columns_exposed (users.password_hash, profiles PII).
-- API routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS — these policies block anon/authenticated PostgREST access only.

--1) xero_tokens: was created without RLS
ALTER TABLE public.xero_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "xero_tokens_block_api_access" ON public.xero_tokens;
CREATE POLICY "xero_tokens_block_api_access"
  ON public.xero_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 2) users: remove open policy that exposed password_hash via API keys
DROP POLICY IF EXISTS "app_all_users" ON public.users;
CREATE POLICY "users_block_api_access"
  ON public.users
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 3) profiles: tighten PII (email, etc.) — same pattern
DROP POLICY IF EXISTS "app_all_profiles" ON public.profiles;
CREATE POLICY "profiles_block_api_access"
  ON public.profiles
  FOR ALL
  USING (false)
  WITH CHECK (false);
