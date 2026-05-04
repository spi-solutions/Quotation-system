import { NextRequest, NextResponse } from 'next/server'
import * as widthRepository from '@/lib/repositories/widthRepository'

export async function GET() {
  try {
    const items = await widthRepository.list()
    return NextResponse.json({ data: items })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch widths' },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const created = await widthRepository.create({
      width_value: body.width_value,
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create width' },
      { status: 400 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = await widthRepository.update(body.id, {
      width_value: body.width_value,
    })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update width' },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    await widthRepository.remove(body.id)
    return NextResponse.json({ data: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete width' },
      { status: 400 }
    )
  }
}

