import { NextRequest, NextResponse } from 'next/server'
import * as customerRepository from '@/lib/repositories/customerRepository'

export async function GET() {
  try {
    const customers = await customerRepository.list()
    return NextResponse.json({ data: customers })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const status = msg.includes('exist') || msg.includes('schema') ? 500 : 400
    return NextResponse.json(
      { error: msg || 'Failed to fetch customers' },
      { status }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.email || !body.name) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    const existing = await customerRepository.findByEmail(body.email)

    if (existing) {
      return NextResponse.json({ data: existing }, { status: 200 })
    }

    const created = await customerRepository.create({
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
      address: body.address ?? null,
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const status = msg.includes('exist') || msg.includes('schema') ? 500 : 400
    return NextResponse.json(
      { error: msg || 'Failed to create customer' },
      { status }
    )
  }
}

