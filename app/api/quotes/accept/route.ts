import { NextRequest, NextResponse } from 'next/server'
import { verifyQuoteAcceptToken } from '@/lib/email/quoteAcceptToken'
import { updateStatus } from '@/lib/services/statusService'
import { syncApprovedQuoteToXero } from '@/lib/services/xeroSyncService'
import * as quoteRepository from '@/lib/repositories/quoteRepository'
import * as customerRepository from '@/lib/repositories/customerRepository'

function htmlPage(title: string, message: string): NextResponse {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="font-family: system-ui, sans-serif; padding: 24px; color: #1e293b;">
  <h1 style="font-size: 20px; margin-bottom: 8px;">${title}</h1>
  <p>${message}</p>
</body>
</html>`
  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim()
  if (!token) {
    return htmlPage('Invalid link', 'This quote acceptance link is missing a token.')
  }

  const payload = await verifyQuoteAcceptToken(token)
  if (!payload) {
    return htmlPage('Invalid or expired link', 'Please contact us to resend your quote acceptance link.')
  }

  const quote = await quoteRepository.findById(payload.quoteId)
  if (!quote) {
    return htmlPage('Quote not found', 'This quote could not be found.')
  }

  const customer = await customerRepository.findById(quote.customer_id)
  const customerEmail = customer?.email?.trim().toLowerCase() || ''
  if (!customer || customerEmail !== payload.customerEmail) {
    return htmlPage('Link mismatch', 'This acceptance link does not match the quote customer.')
  }

  if (quote.status === 'Approved' || quote.status === 'Invoiced') {
    return htmlPage('Already accepted', `Quote ${quote.quote_number} is already accepted.`)
  }

  if (quote.status !== 'Sent' && quote.status !== 'EmailQueued') {
    return htmlPage(
      'Quote cannot be accepted',
      `Quote ${quote.quote_number} is currently ${quote.status} and cannot be accepted from this link.`
    )
  }

  try {
    await updateStatus(quote.id, 'Approved')
    await syncApprovedQuoteToXero(quote.id)
    return htmlPage('Quote accepted', `Thank you. Quote ${quote.quote_number} has been accepted.`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to accept quote'
    return htmlPage('Unable to accept quote', msg)
  }
}

