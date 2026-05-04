import { dbInsert, dbSelect, dbUpdate } from '../db/query'
import type { Customer, NewCustomer } from '../types/customer'

const TABLE = 'customers' as const

export async function findByEmail(email: string): Promise<Customer | null> {
  const data = await dbSelect<Customer[]>(TABLE, (q) =>
    q.select('*').eq('email', email).limit(1)
  )
  return data[0] ?? null
}

/** Case-insensitive lookup by email (e.g. for matching session email to quote customer). */
export async function findByEmailIgnoreCase(email: string): Promise<Customer | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const data = await dbSelect<Customer[]>(TABLE, (q) =>
    (q as any).select('*').ilike('email', normalized).limit(1)
  )
  return data[0] ?? null
}

export async function findById(id: number): Promise<Customer | null> {
  const data = await dbSelect<Customer[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function create(payload: NewCustomer): Promise<Customer> {
  return dbInsert<Customer>(TABLE, payload as any)
}

export async function list(): Promise<Customer[]> {
  return dbSelect<Customer[]>(TABLE, (q) => q.select('*').order('created_at', { ascending: false }))
}

export async function updateById(
  id: number,
  patch: Partial<Pick<Customer, 'xero_contact_id'>>
): Promise<Customer> {
  return dbUpdate<Customer>(TABLE, { id } as any, patch as any)
}

