  -- Persist Xero OAuth refresh token so rotated tokens survive restarts/deploys
  CREATE TABLE IF NOT EXISTS public.xero_tokens (
    provider TEXT PRIMARY KEY,
    refresh_token TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Ensure we always keep a single logical row for Xero
  ALTER TABLE public.xero_tokens
    ADD CONSTRAINT xero_tokens_provider_check
    CHECK (provider = 'xero');
