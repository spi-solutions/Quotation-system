import { dbInsert, dbSelect, dbUpdate, dbDelete } from '../db/query'
import type { CostingRule } from '../types/pricing'

const TABLE = 'costing_rules' as const

type NewRule = Omit<CostingRule, 'id'>

export async function findById(id: number): Promise<CostingRule | null> {
  const data = await dbSelect<CostingRule[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function findByProduct(
  productId: number
): Promise<CostingRule[]> {
  return dbSelect<CostingRule[]>(TABLE, (q) =>
    q.select('*').eq('product_id', productId)
  )
}

export async function list(): Promise<CostingRule[]> {
  return dbSelect<CostingRule[]>(TABLE, (q) => q.select('*'))
}

export async function create(payload: NewRule): Promise<CostingRule> {
  return dbInsert<CostingRule>(TABLE, payload as any)
}

export async function update(
  id: number,
  patch: Partial<NewRule>
): Promise<CostingRule> {
  return dbUpdate<CostingRule>(TABLE, { id } as any, patch as any)
}

export async function remove(id: number): Promise<void> {
  return dbDelete(TABLE, { id })
}

