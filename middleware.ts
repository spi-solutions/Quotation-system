import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getSessionCookieName } from './lib/auth/session'

const ADMIN_PREFIX = '/api/admin'
const AUTH_REQUIRED_PREFIXES = ['/api/profile', '/api/quotes', '/api/products', '/api/fabric-groups']
const PUBLIC_API_PATHS = ['/api/quotes/accept']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const token = req.cookies.get(getSessionCookieName())?.value
  let userId = ''
  let role: 'admin' | 'user' = 'user'
  if (token) {
    const payload = await verifySession(token)
    if (payload) {
      userId = payload.userId
      role = payload.role
    }
  }

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-user-id', userId)
  requestHeaders.set('x-user-role', role)

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (!userId || role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const isPublicPath = PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))
  const needsAuth = !isPublicPath && AUTH_REQUIRED_PREFIXES.some((p) => pathname.startsWith(p))
  if (needsAuth && !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/api/:path*'],
}
