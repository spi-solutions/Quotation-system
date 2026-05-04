import { createHash, randomBytes } from 'crypto'

const TOKEN_TTL_MINUTES = 30

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashPasswordResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function getPasswordResetExpiryIso(): string {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000)
  return expiresAt.toISOString()
}
