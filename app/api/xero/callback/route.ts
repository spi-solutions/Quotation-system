import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookieName, verifySession } from '@/lib/auth/session'
import * as xeroTokenRepository from '@/lib/repositories/xeroTokenRepository'
import { createHmac, timingSafeEqual } from 'crypto'

const XERO_OAUTH_STATE_COOKIE = 'xero_oauth_state'
const STATE_MAX_AGE_MS = 10 * 60 * 1000

function getStateSigningSecret(): string {
  return process.env.SESSION_SECRET || 'default-secret-change-in-production'
}

function validateSignedOAuthState(state: string): { valid: boolean; reason?: string } {
  const [payloadB64, signatureB64] = state.split('.')
  if (!payloadB64 || !signatureB64) return { valid: false, reason: 'malformed_state' }

  const expectedSig = createHmac('sha256', getStateSigningSecret()).update(payloadB64).digest('base64url')
  const expectedBuf = Buffer.from(expectedSig)
  const providedBuf = Buffer.from(signatureB64)
  if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
    return { valid: false, reason: 'bad_signature' }
  }

  try {
    const payloadRaw = Buffer.from(payloadB64, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadRaw) as { iat?: number }
    const iat = Number(payload.iat || 0)
    if (!iat) return { valid: false, reason: 'missing_iat' }
    if (Date.now() - iat > STATE_MAX_AGE_MS) return { valid: false, reason: 'expired_state' }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'invalid_payload' }
  }
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

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  error?: string
  error_description?: string
}

type Connection = {
  tenantId?: string
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '')
  const adminRedirect = `${appUrl}/admin`
  const url = new URL(req.url)
  const code = url.searchParams.get('code')?.trim()
  const state = url.searchParams.get('state')?.trim()
  const oauthError = url.searchParams.get('error')?.trim()
  const cookieState = req.cookies.get(XERO_OAUTH_STATE_COOKIE)?.value?.trim()

  const clearStateCookie = (res: NextResponse) => {
    res.cookies.set({
      name: XERO_OAUTH_STATE_COOKIE,
      value: '',
      path: '/api/xero/callback',
      maxAge: 0,
    })
    return res
  }

  if (oauthError) {
    const reason = url.searchParams.get('error_description') || oauthError
    return clearStateCookie(
      NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent(reason)}`)
    )
  }
  console.info('[xero/oauth] callback received state', {
    returnedStatePrefix: state ? state.slice(0, 18) : null,
    returnedStateLength: state?.length ?? 0,
    cookieStatePrefix: cookieState ? cookieState.slice(0, 18) : null,
    cookieStateLength: cookieState?.length ?? 0,
  })
  if (!state) {
    return clearStateCookie(
      NextResponse.redirect(
        `${adminRedirect}?xero=error&reason=${encodeURIComponent('Invalid OAuth state')}`
      )
    )
  }
  const stateValidation = validateSignedOAuthState(state)
  if (!stateValidation.valid) {
    console.warn('[xero/oauth] state validation failed', {
      reason: stateValidation.reason,
    })
    return clearStateCookie(
      NextResponse.redirect(
        `${adminRedirect}?xero=error&reason=${encodeURIComponent('Invalid OAuth state')}`
      )
    )
  }
  // Cookie comparison remains useful for diagnostics and replay mitigation signals.
  if (!cookieState || cookieState !== state) {
    console.warn('[xero/oauth] state cookie mismatch detected', {
      hasCookieState: Boolean(cookieState),
      cookieMatchesReturnedState: cookieState === state,
    })
  }
  // Callback is authorized by OAuth state; admin session check remains as a defense-in-depth check.
  if (!(await isAdmin(req))) {
    return clearStateCookie(
      NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent('Forbidden')}`)
    )
  }
  if (!code) {
    return clearStateCookie(
      NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent('Missing code')}`)
    )
  }

  const clientId = process.env.XERO_CLIENT_ID?.trim()
  const clientSecret = process.env.XERO_CLIENT_SECRET?.trim()
  const redirectUri = `${appUrl}/api/xero/callback`
  if (!clientId || !clientSecret) {
    return clearStateCookie(
      NextResponse.redirect(
        `${adminRedirect}?xero=error&reason=${encodeURIComponent(
          'Missing XERO_CLIENT_ID / XERO_CLIENT_SECRET'
        )}`
      )
    )
  }

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const tokenRes = await fetchWithTimeout('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenJson = (await tokenRes.json().catch(() => ({}))) as TokenResponse
    if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.refresh_token) {
      const reason =
        tokenJson.error_description ||
        tokenJson.error ||
        `Token exchange failed (${tokenRes.status})`
      return clearStateCookie(
        NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent(reason)}`)
      )
    }

    const connectionsRes = await fetchWithTimeout('https://api.xero.com/connections', {
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        Accept: 'application/json',
      },
    })
    const connections = (await connectionsRes.json().catch(() => [])) as Connection[]
    const expectedTenantId = process.env.XERO_TENANT_ID?.trim()
    const tenantId = Array.isArray(connections)
      ? expectedTenantId
        ? (connections.find((c) => c.tenantId?.trim() === expectedTenantId)?.tenantId?.trim() ?? '')
        : (connections[0]?.tenantId?.trim() ?? '')
      : ''
    if (!connectionsRes.ok || !tenantId) {
      const reason = expectedTenantId
        ? `Unable to resolve configured tenant (${expectedTenantId})`
        : `Unable to resolve Xero tenant (${connectionsRes.status})`
      return clearStateCookie(
        NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent(reason)}`)
      )
    }

    await xeroTokenRepository.upsertTokenRow({
      refresh_token: tokenJson.refresh_token,
      tenant_id: tenantId,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Xero connection failed'
    return clearStateCookie(
      NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent(message)}`)
    )
  }

  return clearStateCookie(NextResponse.redirect(`${adminRedirect}?xero=connected`))
}

