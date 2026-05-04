import { NextRequest, NextResponse } from 'next/server'
import { createQuote } from '@/lib/services/quoteService'
import * as quoteRepository from '@/lib/repositories/quoteRepository'
import * as customerRepository from '@/lib/repositories/customerRepository'
import { verifySession, getSessionCookieName } from '@/lib/auth/session'
import type { QuoteStatus } from '@/lib/types/quote'
import { sendQuoteEmail } from '@/lib/email/sendQuoteEmail'

function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id') || null
}
function getRole(req: NextRequest): 'admin' | 'user' {
  return req.headers.get('x-user-role') === 'admin' ? 'admin' : 'user'
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req)
  const role = getRole(req)
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as QuoteStatus | null
    if (role === 'admin') {
      const quotes = await quoteRepository.list({
        ...(status && { status }),
      })    
      return NextResponse.json({ data: quotes })
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Non-admin: show quotes where the customer email matches the logged-in user (quotes sent to them)
    const token = req.cookies.get(getSessionCookieName())?.value
    const session = token ? await verifySession(token) : null
    const userEmail = session?.email?.trim().toLowerCase()
    if (!userEmail) {
      return NextResponse.json({ data: [] })
    }
    const customer = await customerRepository.findByEmailIgnoreCase(userEmail)
    if (!customer) {
      return NextResponse.json({ data: [] })
    }
    const quotes = await quoteRepository.list({
      customerId: customer.id,
      ...(status && { status }),
    })
    return NextResponse.json({ data: quotes })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list quotes'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req)
  const role = getRole(req)
  if (role !== 'admin') {
    return NextResponse.json(
      { error: 'Only admins can create quotations. You will receive quotes by email.' },
      { status: 403 }
    )
  }
  try {
    const body = await req.json()

    const rawItems = Array.isArray(body.items) && body.items.length
      ? body.items
      : body.productId
        ? [
            {
              productId: body.productId,
              fabricGroupId: body.fabricGroupId,
              inputWidth: body.inputWidth,
              inputDrop: body.inputDrop,
              quantity: body.quantity,
              locationLabel: body.locationLabel ?? 'Window',
              locationOther: body.locationOther ?? null,
            },
          ]
        : []

    let customCostingRules: { ruleName: string; ruleType: string; value: number }[] | undefined
    if (Array.isArray(body.customCostingRules) && body.customCostingRules.length > 0) {
      const valid = body.customCostingRules.every(
        (r: any) => {
          if (!r || typeof r.ruleName !== 'string' || r.ruleName.trim() === '') return false
          if (r.ruleType !== 'percentage' && r.ruleType !== 'fixed') return false
          const v = Number(r.value)
          return !Number.isNaN(v)
        }
      )
      if (valid) {
        customCostingRules = body.customCostingRules.map((r: any) => ({
          ruleName: String(r.ruleName).trim(),
          ruleType: r.ruleType,
          value: Number(r.value),
        }))
      }
    }

    const result = await createQuote({
      customer: {
        name: body.customer?.name,
        email: body.customer?.email,
        phone: body.customer?.phone ?? null,
        address: body.customer?.address ?? null,
      },
      items: rawItems.map((item: any) => {
        const q = Number(item.quantity)
        const quantity =
          Number.isFinite(q) && Number.isInteger(q) && q >= 1 ? q : 1
        return {
          productId: Number(item.productId),
          fabricGroupId: Number(item.fabricGroupId),
          inputWidth: Number(item.inputWidth),
          inputDrop: Number(item.inputDrop),
          quantity,
          locationLabel: String(item.locationLabel || 'Window'),
          locationOther:
            item.locationOther != null && String(item.locationOther).trim() !== ''
              ? String(item.locationOther)
              : null,
        }
      }),
      additionalInfo: String(body.additionalInfo || '').trim(),
      etaText: String(body.etaText || '').trim(),
      createdByUserId: userId ?? undefined,
      ...(customCostingRules && { customCostingRules }),
    })

    const emailResult = await sendQuoteEmail({
      to: result.customer.email,
      customerName: result.customer.name,
      quoteNumber: result.quote.quote_number,
      quoteId: result.quote.id,
      totalAmount: Number(result.quote.final_total),
    })

    const finalStatus = emailResult.sent ? 'Sent' : 'EmailFailed'
    const quoteAfterSend = await quoteRepository.updateStatus(
      result.quote.id,
      finalStatus
    )

    return NextResponse.json(
      {
        data: {
          ...result,
          quote: quoteAfterSend,
        },
        emailSent: emailResult.sent,
        ...(emailResult.sent === false && 'reason' in emailResult && { emailError: emailResult.reason }),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create quote'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

