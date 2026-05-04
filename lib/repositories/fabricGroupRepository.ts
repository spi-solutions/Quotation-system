import { dbInsert, dbSelect, dbUpdate, dbDelete } from '../db/query'
import type { FabricGroup } from '../types/pricing'

const TABLE = 'fabric_groups' as const

type NewFabricGroup = Omit<FabricGroup, 'id'>

export async function create(payload: NewFabricGroup): Promise<FabricGroup> {
  return dbInsert<FabricGroup>(TABLE, payload as any)
}

export async function update(
  id: number,
  patch: Partial<NewFabricGroup>
): Promise<FabricGroup> {
  return dbUpdate<FabricGroup>(TABLE, { id } as any, patch as any)
}

export async function remove(id: number): Promise<void> {
  await dbDelete(TABLE, { id })
}

export async function list(): Promise<FabricGroup[]> {
  return dbSelect<FabricGroup[]>(TABLE, (q) =>
    q.select('*').order('group_number', { ascending: true })
  )
}

export async function findById(id: number): Promise<FabricGroup | null> {
  const data = await dbSelect<FabricGroup[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

