import { NextRequest, NextResponse } from 'next/server'
import * as dropRepository from '@/lib/repositories/dropRepository'

export async function GET() {
  try {
    const items = await dropRepository.list()
    return NextResponse.json({ data: items })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch drops' },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const created = await dropRepository.create({
      drop_value: body.drop_value,
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create drop' },
      { status: 400 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = await dropRepository.update(body.id, {
      drop_value: body.drop_value,
    })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update drop' },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    await dropRepository.remove(body.id)
    return NextResponse.json({ data: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete drop' },
      { status: 400 }
    )
  }
}

