import { NextRequest, NextResponse } from 'next/server'
import * as productRepository from '@/lib/repositories/productRepository'

export async function GET() {
  try {
    const products = await productRepository.list()
    return NextResponse.json({ data: products })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch products' },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const created = await productRepository.create({
      name: body.name,
      pricing_type: body.pricing_type,
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create product' },
      { status: 400 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = await productRepository.update(body.id, {
      name: body.name,
      pricing_type: body.pricing_type,
    })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update product' },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    await productRepository.remove(body.id)
    return NextResponse.json({ data: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete product' },
      { status: 400 }
    )
  }
}

