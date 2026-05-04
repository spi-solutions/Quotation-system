import { NextRequest, NextResponse } from 'next/server'
import { verifySession, getSessionCookieName } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(getSessionCookieName())?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const payload = await verifySession(token)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    data: {
      user: {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      },
    },
  })
}
