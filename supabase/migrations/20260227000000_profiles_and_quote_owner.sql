-- Run this in Supabase SQL editor to add profile and quote-owner support.
-- Schema app must already exist.

-- Profile per auth user (link to Supabase Auth)
CREATE TABLE IF NOT EXISTS app.profiles (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Allow quotes to be owned by the user who created them (for "my quotations")
ALTER TABLE app.quotes
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID;
