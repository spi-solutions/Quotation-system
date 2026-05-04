import { NextRequest, NextResponse } from 'next/server'
import * as userRepository from '@/lib/repositories/userRepository'
import { hashPassword } from '@/lib/auth/password'
import { createSession, getSessionCookieName } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = (body.email as string)?.trim()?.toLowerCase()
    const password = body.password as string

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const existing = await userRepository.findByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    const password_hash = await hashPassword(password)
    const user = await userRepository.create({
      email,
      password_hash,
      role: 'user',
    })

    const token = await createSession({
      userId: String(user.id),
      email: user.email,
      role: user.role,
    })

    const res = NextResponse.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    })
    res.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const code = err && typeof err === 'object' && 'context' in err && typeof (err as { context?: { code?: string } }).context?.code === 'string'
      ? (err as { context: { code: string } }).context.code
      : (err instanceof Error && err.cause && typeof (err.cause as any)?.code === 'string' ? (err.cause as any).code : undefined)
    const cause = err instanceof Error && err.cause ? String((err.cause as Error).message) : ''
    const status = msg.includes('exist') || msg.includes('duplicate') ? 400 : 500
    const detail: Record<string, string | undefined> =
      process.env.NODE_ENV === 'development'
        ? { error: msg, code: code || undefined, cause: cause || undefined }
        : { error: msg }
    return NextResponse.json(detail, { status })
  }
}
