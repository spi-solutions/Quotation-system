import { dbInsert, dbSelect, dbUpdate } from '../db/query'
import type { Profile, NewProfile, ProfileUpdate } from '../types/profile'

const TABLE = 'profiles' as const

export async function findByAuthUserId(
  authUserId: string
): Promise<Profile | null> {
  const data = await dbSelect<Profile[]>(TABLE, (q) =>
    q.select('*').eq('auth_user_id', authUserId).limit(1)
  )
  return data[0] ?? null
}

export async function create(payload: NewProfile): Promise<Profile> {
  return dbInsert<Profile>(TABLE, payload as any)
}

export async function update(
  authUserId: string,
  patch: ProfileUpdate
): Promise<Profile> {
  return dbUpdate<Profile>(TABLE, { auth_user_id: authUserId } as any, {
    ...patch,
    updated_at: new Date().toISOString(),
  } as any)
}
