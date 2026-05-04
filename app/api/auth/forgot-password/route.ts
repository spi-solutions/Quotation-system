import { NextRequest, NextResponse } from 'next/server'
import * as userRepository from '@/lib/repositories/userRepository'
import * as passwordResetTokenRepository from '@/lib/repositories/passwordResetTokenRepository'
import {
  generatePasswordResetToken,
  getPasswordResetExpiryIso,
  hashPasswordResetToken,
} from '@/lib/auth/passwordResetToken'
import { sendPasswordResetEmail } from '@/lib/email/sendPasswordResetEmail'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await userRepository.findByEmail(email)
    if (user) {
      const rawToken = generatePasswordResetToken()
      const tokenHash = hashPasswordResetToken(rawToken)
      const expiresAt = getPasswordResetExpiryIso()

      await passwordResetTokenRepository.deleteAllForUser(user.id)
      await passwordResetTokenRepository.create({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '')
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
      await sendPasswordResetEmail({ to: user.email, resetUrl })
    }

    return NextResponse.json({
      data: {
        ok: true,
        message:
          'If an account exists for that email, a reset link has been sent.',
      },
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to request password reset'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
