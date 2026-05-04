import { dbDelete, dbInsert, dbSelect, dbUpdate } from '@/lib/db/query'
import type {
  NewPasswordResetToken,
  PasswordResetToken,
} from '@/lib/types/passwordResetToken'

const TABLE = 'password_reset_tokens' as const

export async function create(
  payload: NewPasswordResetToken
): Promise<PasswordResetToken> {
  return dbInsert<PasswordResetToken>(TABLE, payload as any)
}

export async function findActiveByTokenHash(
  tokenHash: string
): Promise<PasswordResetToken | null> {
  const nowIso = new Date().toISOString()
  const rows = await dbSelect<PasswordResetToken[]>(TABLE, (q) =>
    q
      .select('*')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .limit(1)
  )
  return rows[0] ?? null
}

export async function markUsed(id: number): Promise<PasswordResetToken> {
  return dbUpdate<PasswordResetToken>(
    TABLE,
    { id } as any,
    { used_at: new Date().toISOString() } as any
  )
}

export async function deleteAllForUser(userId: number): Promise<void> {
  await dbDelete(TABLE, { user_id: userId })
}
