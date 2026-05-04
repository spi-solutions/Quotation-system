import { NextRequest, NextResponse } from 'next/server'
import * as userRepository from '@/lib/repositories/userRepository'
import { verifyPassword } from '@/lib/auth/password'
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

    const user = await userRepository.findByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
