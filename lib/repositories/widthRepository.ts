import { dbInsert, dbSelect, dbUpdate, dbDelete } from '../db/query'
import type { Width } from '../types/pricing'

const TABLE = 'widths' as const

type NewWidth = Omit<Width, 'id'>

export async function create(payload: NewWidth): Promise<Width> {
  return dbInsert<Width>(TABLE, payload as any)
}

export async function update(
  id: number,
  patch: Partial<NewWidth>
): Promise<Width> {
  return dbUpdate<Width>(TABLE, { id } as any, patch as any)
}

export async function remove(id: number): Promise<void> {
  await dbDelete(TABLE, { id })
}

export async function list(): Promise<Width[]> {
  return dbSelect<Width[]>(TABLE, (q) =>
    q.select('*').order('width_value', { ascending: true })
  )
}

export async function findById(id: number): Promise<Width | null> {
  const data = await dbSelect<Width[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function findNearest(value: number): Promise<Width | null> {
  const data = await dbSelect<Width[]>(TABLE, (q) =>
    q
      .select('*')
      .order('width_value', { ascending: true })
  )

  if (!data.length) return null

  let nearest = data[0]
  let minDiff = Math.abs(nearest.width_value - value)

  for (const row of data) {
    const diff = Math.abs(row.width_value - value)
    if (diff < minDiff) {
      minDiff = diff
      nearest = row
    }
  }

  return nearest
}

