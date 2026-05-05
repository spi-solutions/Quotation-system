import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookieName, verifySession } from '@/lib/auth/session'
import * as xeroTokenRepository from '@/lib/repositories/xeroTokenRepository'

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

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '')
  const adminRedirect = `${appUrl}/admin`
  const url = new URL(req.url)
  const code = url.searchParams.get('code')?.trim()
  const oauthError = url.searchParams.get('error')?.trim()

  if (oauthError) {
    const reason = url.searchParams.get('error_description') || oauthError
    return NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent(reason)}`)
  }
  if (!code) {
    return NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent('Missing code')}`)
  }

  const clientId = process.env.XERO_CLIENT_ID?.trim()
  const clientSecret = process.env.XERO_CLIENT_SECRET?.trim()
  const redirectUri = `${appUrl}/api/xero/callback`
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${adminRedirect}?xero=error&reason=${encodeURIComponent(
        'Missing XERO_CLIENT_ID / XERO_CLIENT_SECRET'
      )}`
    )
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenRes = await fetch('https://identity.xero.com/connect/token', {
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
    return NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent(reason)}`)
  }

  const connectionsRes = await fetch('https://api.xero.com/connections', {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: 'application/json',
    },
  })
  const connections = (await connectionsRes.json().catch(() => [])) as Connection[]
  const tenantId = Array.isArray(connections) ? connections[0]?.tenantId?.trim() : ''
  if (!connectionsRes.ok || !tenantId) {
    const reason = `Unable to resolve Xero tenant (${connectionsRes.status})`
    return NextResponse.redirect(`${adminRedirect}?xero=error&reason=${encodeURIComponent(reason)}`)
  }

  await xeroTokenRepository.upsertTokenRow({
    refresh_token: tokenJson.refresh_token,
    tenant_id: tenantId,
  })

  return NextResponse.redirect(`${adminRedirect}?xero=connected`)
}

