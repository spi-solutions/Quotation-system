import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookieName, verifySession } from '@/lib/auth/session'

const XERO_OAUTH_STATE_COOKIE = 'xero_oauth_state'

function getRole(req: NextRequest): 'admin' | 'user' {
  return req.headers.get('x-user-role') === 'admin' ? 'admin' : 'user'
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  if (getRole(req) === 'admin') return true
  const token = req.cookies.get(getSessionCookieName())?.value
  const session = token ? await verifySession(token) : null
  return session?.role === 'admin'
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clientId = process.env.XERO_CLIENT_ID?.trim()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '')
  const callbackUri = `${appUrl}/api/xero/callback`
  if (!clientId) {
    return NextResponse.json({ error: 'XERO_CLIENT_ID is not configured' }, { status: 500 })
  }

  const scope = 'openid profile email offline_access accounting.contacts accounting.transactions'
  const state = crypto.randomUUID()
  const authorizeUrl =
    `https://login.xero.com/identity/connect/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${encodeURIComponent(state)}`

  const res = NextResponse.redirect(authorizeUrl)
  res.cookies.set({
    name: XERO_OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/xero/callback',
    maxAge: 60 * 10,
  })
  return res
}

