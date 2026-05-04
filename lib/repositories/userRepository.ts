import { dbInsert, dbSelect, dbUpdate } from '../db/query'
import type { User, NewUser } from '../types/user'

const TABLE = 'users' as const

export async function findByEmail(email: string): Promise<User | null> {
  const data = await dbSelect<User[]>(TABLE, (q) =>
    q.select('*').eq('email', email.toLowerCase().trim()).limit(1)
  )
  return data[0] ?? null
}

export async function findById(id: number): Promise<User | null> {
  const data = await dbSelect<User[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function create(payload: NewUser): Promise<User> {
  return dbInsert<User>(TABLE, payload as any)
}

export async function updatePassword(
  id: number,
  password_hash: string
): Promise<User> {
  return dbUpdate<User>(
    TABLE,
    { id } as any,
    { password_hash } as any
  )
}
