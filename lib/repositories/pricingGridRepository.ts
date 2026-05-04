import { dbInsert, dbSelect, dbUpdate, dbDelete } from '../db/query'
import type { RollerPricingGridRow } from '../types/pricing'

const TABLE = 'roller_pricing_grid' as const

type NewRow = Omit<RollerPricingGridRow, 'id'>

export async function findById(id: number): Promise<RollerPricingGridRow | null> {
  const data = await dbSelect<RollerPricingGridRow[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function findBasePrice(
  fabricGroupId: number,
  widthId: number,
  dropId: number
): Promise<RollerPricingGridRow | null> {
  const data = await dbSelect<RollerPricingGridRow[]>(TABLE, (q) =>
    q
      .select('*')
      .eq('fabric_group_id', fabricGroupId)
      .eq('width_id', widthId)
      .eq('drop_id', dropId)
      .limit(1)
  )

  return data[0] ?? null
}

export async function list(): Promise<RollerPricingGridRow[]> {
  return dbSelect<RollerPricingGridRow[]>(TABLE, (q) =>
    q
      .select('*')
      .order('fabric_group_id', { ascending: true })
      .order('width_id', { ascending: true })
      .order('drop_id', { ascending: true })
  )
}

export async function create(payload: NewRow): Promise<RollerPricingGridRow> {
  return dbInsert<RollerPricingGridRow>(TABLE, payload as any)
}

export async function update(
  id: number,
  patch: Partial<NewRow>
): Promise<RollerPricingGridRow> {
  return dbUpdate<RollerPricingGridRow>(TABLE, { id } as any, patch as any)
}

export async function remove(id: number): Promise<void> {
  return dbDelete(TABLE, { id })
}

