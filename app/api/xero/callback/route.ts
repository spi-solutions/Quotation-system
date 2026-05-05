import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookieName, verifySession } from '@/lib/auth/session'
import * as xeroTokenRepository from '@/lib/repositories/xeroTokenRepository'

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
  if (!state || !cookieState || state !== cookieState) {
    return clearStateCookie(
      NextResponse.redirect(
        `${adminRedirect}?xero=error&reason=${encodeURIComponent('Invalid OAuth state')}`
      )
    )
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

