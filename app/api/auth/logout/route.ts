import { NextResponse } from 'next/server'
import { getSessionCookieName } from '@/lib/auth/session'

export async function POST() {
  const res = NextResponse.json({ data: { ok: true } })
  res.cookies.set(getSessionCookieName(), '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return res
}
