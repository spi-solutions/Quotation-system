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
  const data = await dbSelect<Drop[]>(TABLE, (q) =>
    q
      .select('*')
      .order('drop_value', { ascending: true })
  )

  if (!data.length) return null

  let nearest = data[0]
  let minDiff = Math.abs(nearest.drop_value - value)

  for (const row of data) {
    const diff = Math.abs(row.drop_value - value)
    if (diff < minDiff) {
      minDiff = diff
      nearest = row
    }
  }

  return nearest
}

