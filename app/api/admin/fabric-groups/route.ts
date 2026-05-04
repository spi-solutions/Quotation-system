import { NextRequest, NextResponse } from 'next/server'
import * as fabricGroupRepository from '@/lib/repositories/fabricGroupRepository'

export async function GET() {
  try {
    const items = await fabricGroupRepository.list()
    return NextResponse.json({ data: items })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch fabric groups' },
      { status: 400 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const created = await fabricGroupRepository.create({
      group_number: body.group_number,
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create fabric group' },
      { status: 400 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const updated = await fabricGroupRepository.update(body.id, {
      group_number: body.group_number,
    })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update fabric group' },
      { status: 400 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    await fabricGroupRepository.remove(body.id)
    return NextResponse.json({ data: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete fabric group' },
      { status: 400 }
    )
  }
}

