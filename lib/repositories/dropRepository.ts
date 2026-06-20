import { dbInsert, dbSelect, dbUpdate, dbDelete } from '../db/query'
import type { Drop } from '../types/pricing'

const TABLE = 'drops' as const

type NewDrop = Omit<Drop, 'id'>

export async function create(payload: NewDrop): Promise<Drop> {
  return dbInsert<Drop>(TABLE, payload as any)
}

export async function update(
  id: number,
  patch: Partial<NewDrop>
): Promise<Drop> {
  return dbUpdate<Drop>(TABLE, { id } as any, patch as any)
}

export async function remove(id: number): Promise<void> {
  await dbDelete(TABLE, { id })
}

export async function list(): Promise<Drop[]> {
  return dbSelect<Drop[]>(TABLE, (q) =>
    q.select('*').order('drop_value', { ascending: true })
  )
}

export async function findById(id: number): Promise<Drop | null> {
  const data = await dbSelect<Drop[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function findNearest(value: number): Promise<Drop | null> {
  const nextHigher = await dbSelect<Drop[]>(TABLE, (q) =>
    q
      .select('*')
      .gte('drop_value', value)
      .order('drop_value', { ascending: true })
      .limit(1)
  )

  if (nextHigher.length) return nextHigher[0]

  const largest = await dbSelect<Drop[]>(TABLE, (q) =>
    q
      .select('*')
      .order('drop_value', { ascending: false })
      .limit(1)
  )

  return largest[0] ?? null
}

