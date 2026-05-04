import { NextRequest, NextResponse } from 'next/server'
import * as userRepository from '@/lib/repositories/userRepository'
import { verifyPassword, hashPassword } from '@/lib/auth/password'
import { verifySession, getSessionCookieName } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(getSessionCookieName())?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await verifySession(token)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const userId = Number(session.userId)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid user session' }, { status: 400 })
    }

    const user = await userRepository.findById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const valid = await verifyPassword(currentPassword, user.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    const password_hash = await hashPassword(newPassword)
    await userRepository.updatePassword(user.id, password_hash)

    return NextResponse.json({ data: { ok: true } }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to change password'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

