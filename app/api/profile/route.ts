import { NextRequest, NextResponse } from 'next/server'
import * as profileRepository from '@/lib/repositories/profileRepository'
import type { ProfileUpdate } from '@/lib/types/profile'

function getUserId(req: NextRequest): string | null {
  return req.headers.get('x-user-id') || null
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const profile = await profileRepository.findByAuthUserId(userId)
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }
    return NextResponse.json({ data: profile })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const patch: ProfileUpdate = {}
    if (body.name != null) patch.name = body.name
    if (body.email != null) patch.email = body.email
    if (body.phone != null) patch.phone = body.phone
    if (body.address != null) patch.address = body.address
    let profile = await profileRepository.findByAuthUserId(userId)
    if (!profile) {
      profile = await profileRepository.create({
        auth_user_id: userId,
        name: body.name ?? '',
        email: body.email ?? '',
        phone: body.phone ?? null,
        address: body.address ?? null,
        role: 'user',
      })
    } else {
      profile = await profileRepository.update(userId, patch)
    }
    return NextResponse.json({ data: profile })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update profile'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
