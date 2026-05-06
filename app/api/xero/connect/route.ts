import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookieName, verifySession } from '@/lib/auth/session'
import { createHmac, randomBytes } from 'crypto'

const XERO_OAUTH_STATE_COOKIE = 'xero_oauth_state'
const STATE_MAX_AGE_SECONDS = 60 * 10

function getStateSigningSecret(): string {
  return process.env.SESSION_SECRET || 'default-secret-change-in-production'
}

function createSignedOAuthState(): string {
  const payload = {
    nonce: randomBytes(16).toString('hex'),
    iat: Date.now(),
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', getStateSigningSecret()).update(payloadB64).digest('base64url')
  return `${payloadB64}.${sig}`
}

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

  // Invoice create uses /Invoices → needs granular accounting.invoices (broad accounting.transactions is deprecated for new web apps).
  // Override via XERO_OAUTH_SCOPES if needed.
  const scope =
    process.env.XERO_OAUTH_SCOPES?.trim() ||
    'offline_access accounting.contacts accounting.invoices'
  const state = createSignedOAuthState()
  console.info('[xero/oauth] generated state for connect', {
    statePrefix: state.slice(0, 18),
    stateLength: state.length,
  })
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
    maxAge: STATE_MAX_AGE_SECONDS,
  })
  console.info('[xero/oauth] state cookie set for callback', {
    cookieName: XERO_OAUTH_STATE_COOKIE,
    path: '/api/xero/callback',
    maxAgeSeconds: STATE_MAX_AGE_SECONDS,
  })
  return res
}

