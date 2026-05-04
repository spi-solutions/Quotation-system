import { NextRequest, NextResponse } from 'next/server'
import { updateStatus } from '@/lib/services/statusService'
import * as quoteRepository from '@/lib/repositories/quoteRepository'
import * as customerRepository from '@/lib/repositories/customerRepository'
import { verifySession, getSessionCookieName } from '@/lib/auth/session'
import type { QuoteStatus } from '@/lib/types/quote'
import { syncApprovedQuoteToXero } from '@/lib/services/xeroSyncService'

type Params = { params: { id: string } }

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

export async function PATCH(req: NextRequest, { params }: Params) {
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
    const body = await req.json()
    const newStatus = body.status as QuoteStatus
    const previousStatus = quote.status
    const updated = await updateStatus(id, newStatus)

    if (newStatus === 'Approved' && (previousStatus === 'Sent' || previousStatus === 'EmailQueued')) {
      console.info('[quotes/status] sent → Approved: invoking Xero sync', {
        quoteId: id,
        quoteNumber: quote.quote_number,
      })
      await syncApprovedQuoteToXero(id)
    }

    const finalQuote = await quoteRepository.findById(id)
    return NextResponse.json({ data: finalQuote ?? updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update status'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

