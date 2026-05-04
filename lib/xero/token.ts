import * as xeroTokenRepository from '@/lib/repositories/xeroTokenRepository'

/**
 * OAuth2 refresh-token flow for Xero (server-side only).
 * Client credentials stay in env. Rotating refresh token is persisted in DB.
 */
export async function getXeroAccessToken(): Promise<{
  accessToken: string
  tenantId: string
} | null> {
  const clientId = process.env.XERO_CLIENT_ID?.trim()
  const clientSecret = process.env.XERO_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    const required = [
      ['XERO_CLIENT_ID', clientId],
      ['XERO_CLIENT_SECRET', clientSecret],
    ] as const
    const missing = required.filter(([, v]) => !v).map(([k]) => k)
    console.warn('[xero] Token unavailable: missing env —', missing.join(', '))
    return null
  }

  const dbRow = await xeroTokenRepository.getTokenRow().catch((e: unknown) => {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[xero] Token store read failed; falling back to env token', { error: message })
    return null
  })

  const envRefreshToken = process.env.XERO_REFRESH_TOKEN?.trim() || null
  const envTenantId = process.env.XERO_TENANT_ID?.trim() || null
  const refreshToken = dbRow?.refresh_token?.trim() || envRefreshToken
  const tenantId = dbRow?.tenant_id?.trim() || envTenantId

  if (!refreshToken || !tenantId) {
    const missing: string[] = []
    if (!refreshToken) missing.push('XERO_REFRESH_TOKEN (or xero_tokens.refresh_token)')
    if (!tenantId) missing.push('XERO_TENANT_ID (or xero_tokens.tenant_id)')
    console.warn('[xero] Token unavailable: missing token source —', missing.join(', '))
    return null
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const raw = await res.text()
  let data: {
    access_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  } = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    console.error('[xero] Token response: invalid JSON', { httpStatus: res.status, bodyLength: raw.length })
    data = {}
  }

  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || `Token refresh failed (${res.status})`
    console.error('[xero] Token refresh failed', {
      httpStatus: res.status,
      error: data.error ?? null,
      error_description: data.error_description ?? null,
    })
    throw new Error(msg)
  }

  const rotatedRefreshToken = data.refresh_token?.trim() || refreshToken
  await xeroTokenRepository
    .upsertTokenRow({
      refresh_token: rotatedRefreshToken,
      tenant_id: tenantId,
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[xero] Failed to persist rotated refresh token', { error: message })
    })

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    console.info('[xero] Refresh token rotated and persisted to token store')
  }

  return { accessToken: data.access_token, tenantId }
}
