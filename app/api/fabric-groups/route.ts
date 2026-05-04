import { NextResponse } from 'next/server'
import * as fabricGroupRepository from '@/lib/repositories/fabricGroupRepository'

export async function GET() {
  try {
    const items = await fabricGroupRepository.list()
    return NextResponse.json({ data: items })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch fabric groups'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
