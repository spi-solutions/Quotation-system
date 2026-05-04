import { NextRequest, NextResponse } from 'next/server'
import * as passwordResetTokenRepository from '@/lib/repositories/passwordResetTokenRepository'
import * as userRepository from '@/lib/repositories/userRepository'
import { hashPassword } from '@/lib/auth/password'
import { hashPasswordResetToken } from '@/lib/auth/passwordResetToken'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const token = String(body.token || '').trim()
    const newPassword = String(body.newPassword || '')

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    const tokenHash = hashPasswordResetToken(token)
    const resetRow = await passwordResetTokenRepository.findActiveByTokenHash(
      tokenHash
    )
    if (!resetRow) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    const user = await userRepository.findById(resetRow.user_id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const password_hash = await hashPassword(newPassword)
    await userRepository.updatePassword(user.id, password_hash)
    await passwordResetTokenRepository.markUsed(resetRow.id)

    return NextResponse.json({ data: { ok: true } })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to reset password'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
