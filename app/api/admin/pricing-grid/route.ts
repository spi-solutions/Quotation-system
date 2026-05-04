import { NextRequest, NextResponse } from 'next/server'
import * as pricingGridRepository from '@/lib/repositories/pricingGridRepository'

export async function GET() {
  try {
    const items = await pricingGridRepository.list()
    return NextResponse.json({ data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pricing grid'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const created = await pricingGridRepository.create({
      fabric_group_id: body.fabric_group_id,
      width_id: body.width_id,
      drop_id: body.drop_id,
      base_price: body.base_price,
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create pricing grid row'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = await pricingGridRepository.update(body.id, {
      fabric_group_id: body.fabric_group_id,
      width_id: body.width_id,
      drop_id: body.drop_id,
      base_price: body.base_price,
    })
    return NextResponse.json({ data: updated })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update pricing grid'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    await pricingGridRepository.remove(body.id)
    return NextResponse.json({ data: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete pricing grid row'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

