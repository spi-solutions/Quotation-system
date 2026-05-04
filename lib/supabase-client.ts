'use client'

/**
 * Browser Supabase client (SSR). Re-export from central location.
 * Uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export { createClient } from './supabase/client'
