import * as jose from 'jose'

type QuoteAcceptPayload = {
  quoteId: number
  customerEmail: string
}

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'default-secret-change-in-production'
)
const EXPIRY = '14d'

export async function createQuoteAcceptToken(payload: QuoteAcceptPayload): Promise<string> {
  return new jose.SignJWT({
    quoteId: payload.quoteId,
    customerEmail: payload.customerEmail.trim().toLowerCase(),
    type: 'quote_accept',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET)
}

export async function verifyQuoteAcceptToken(token: string): Promise<QuoteAcceptPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET)
    if (payload.type !== 'quote_accept') return null
    const quoteId = Number(payload.quoteId)
    const customerEmail = String(payload.customerEmail || '').trim().toLowerCase()
    if (!Number.isFinite(quoteId) || !customerEmail) return null
    return { quoteId, customerEmail }
  } catch {
    return null
  }
}

