import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

export type AuthUser = {
  id: string
  email?: string
  role: 'admin' | 'user'
}

/**
 * Get the current session from request cookies.
 * Use in API routes to require auth and get user id + role.
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<{ user: AuthUser } | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  )
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) return null
  const role =
    (session.user.user_metadata?.role as 'admin' | 'user') ?? 'user'
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? undefined,
      role: role === 'admin' ? 'admin' : 'user',
    },
  }
}
