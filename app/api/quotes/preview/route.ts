import { NextRequest, NextResponse } from 'next/server'
import { calculatePricing } from '@/lib/services/pricingService'
import { roundTo2 } from '@/lib/utils/rounding'
import { assertProductsAllowedForQuote } from '@/lib/products/offering'

function getRole(req: NextRequest): 'admin' | 'user' {
  return req.headers.get('x-user-role') === 'admin' ? 'admin' : 'user'
}

function allocateGstToLines(lineSubtotalsExGst: number[], quoteGst: number): number[] {
  const sum = lineSubtotalsExGst.reduce((a, b) => a + b, 0)
  if (sum <= 0 || lineSubtotalsExGst.length === 0) return lineSubtotalsExGst.map(() => 0)

  const out: number[] = []
  let allocated = 0
  for (let i = 0; i < lineSubtotalsExGst.length; i += 1) {
    if (i === lineSubtotalsExGst.length - 1) {
      out.push(roundTo2(quoteGst - allocated))
    } else {
      const g = roundTo2((quoteGst * lineSubtotalsExGst[i]) / sum)
      out.push(g)
      allocated = roundTo2(allocated + g)
    }
  }
  return out
}

export async function POST(req: NextRequest) {
  if (getRole(req) !== 'admin') {
    return NextResponse.json({ error: 'Only admins can preview quotations.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) {
      return NextResponse.json({ error: 'At least one product line is required' }, { status: 400 })
    }

    await assertProductsAllowedForQuote(
      rawItems.map((item: any) => Number(item.productId)).filter((id: number) => Number.isFinite(id) && id > 0)
    )

    let customCostingRules: { rule_name: string; rule_type: string; value: number }[] | undefined
    if (Array.isArray(body.customCostingRules) && body.customCostingRules.length > 0) {
      const valid = body.customCostingRules.every((r: any) => {
        if (!r || typeof r.ruleName !== 'string' || r.ruleName.trim() === '') return false
        if (r.ruleType !== 'percentage' && r.ruleType !== 'fixed') return false
        const v = Number(r.value)
        return !Number.isNaN(v)
      })
      if (valid) {
        customCostingRules = body.customCostingRules.map((r: any) => ({
          rule_name: String(r.ruleName).trim(),
          rule_type: r.ruleType,
          value: Number(r.value),
        }))
      }
    }

    const linePricing = await Promise.all(
      rawItems.map(async (item: any) => {
        const productId = Number(item.productId)
        const fabricGroupId = Number(item.fabricGroupId)
        const inputWidth = Number(item.inputWidth)
        const inputDrop = Number(item.inputDrop)
        const q = Number(item.quantity)
        const quantity =
          Number.isFinite(q) && Number.isInteger(q) && q >= 1 ? q : 1
        const unit = await calculatePricing({
          productId,
          fabricGroupId,
          inputWidth,
          inputDrop,
          ...(customCostingRules && { customRules: customCostingRules }),
        })
        return { unit, quantity }
      })
    )

    const subtotals = linePricing.map(({ unit, quantity }) =>
      roundTo2(Number(unit.subtotal) * quantity)
    )
    const subtotal = roundTo2(subtotals.reduce((a, b) => a + b, 0))
    const gst = roundTo2(subtotal * 0.1)
    const lineGst = allocateGstToLines(subtotals, gst)
    const lines = linePricing.map(({ quantity }, i) => ({
      lineNumber: i + 1,
      quantity,
      subtotal: subtotals[i],
      gst: lineGst[i],
      finalTotal: roundTo2(subtotals[i] + lineGst[i]),
    }))

    return NextResponse.json({
      data: {
        lines,
        subtotal,
        gst,
        finalTotal: roundTo2(subtotal + gst),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to preview quote pricing'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
