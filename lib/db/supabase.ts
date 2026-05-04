import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Server-side Supabase client for API routes using the public schema.
 * Uses service_role key if set, else anon key.
 */
let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  // Use public schema (default) so we can work with existing public.* tables.
  _client = createSupabaseClient(url, key) as unknown as SupabaseClient
  return _client
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getClient() as any)[prop]
  },
})
