import { NextRequest, NextResponse } from 'next/server'
import * as quoteRepository from '@/lib/repositories/quoteRepository'
import * as customerRepository from '@/lib/repositories/customerRepository'
import { verifySession, getSessionCookieName } from '@/lib/auth/session'
import { generateQuotePdfBytes } from '@/lib/pdf/generateQuotePdf'

export const runtime = 'nodejs'

type Params = {
  params: { id: string }
}

function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id') || null
}
function getRole(req: NextRequest): 'admin' | 'user' {
  return req.headers.get('x-user-role') === 'admin' ? 'admin' : 'user'
}

async function canAccessQuote(
  quote: { customer_id: number; created_by_user_id: string | null },
  role: string,
  userId: string | null,
  req: NextRequest
): Promise<boolean> {
  if (role === 'admin') return true
  if (quote.created_by_user_id && quote.created_by_user_id === userId) return true
  const token = req.cookies.get(getSessionCookieName())?.value
  const session = token ? await verifySession(token) : null
  const sessionEmail = session?.email?.trim().toLowerCase()
  if (!sessionEmail) return false
  const customer = await customerRepository.findById(quote.customer_id)
  return customer?.email?.trim().toLowerCase() === sessionEmail
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const id = Number(params.id)
    const quote = await quoteRepository.findById(id)

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const role = getRole(req)
    const userId = getUserId(req)
    const allowed = await canAccessQuote(quote, role, userId, req)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const pdfBytes = await generateQuotePdfBytes(id)

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="quote-${quote.quote_number}.pdf"`,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}