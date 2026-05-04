import { NextRequest, NextResponse } from 'next/server'
import * as costingRuleRepository from '@/lib/repositories/costingRuleRepository'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const productIdParam = searchParams.get('productId')
    if (!productIdParam) {
      const all = await costingRuleRepository.list()
      return NextResponse.json({ data: all })
    }
    const productId = Number(productIdParam)
    const rules = await costingRuleRepository.findByProduct(productId)
    return NextResponse.json({ data: rules })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch costing rules'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const created = await costingRuleRepository.create({
      product_id: body.product_id,
      rule_name: body.rule_name,
      rule_type: body.rule_type,
      value: body.value,
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create costing rule'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = await costingRuleRepository.update(body.id, {
      product_id: body.product_id,
      rule_name: body.rule_name,
      rule_type: body.rule_type,
      value: body.value,
    })
    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update costing rule'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    await costingRuleRepository.remove(body.id)
    return NextResponse.json({ data: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete costing rule'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

