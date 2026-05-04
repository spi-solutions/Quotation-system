import { dbInsert, dbSelect, dbUpdate, dbDelete } from '../db/query'
import type { Product, NewProduct } from '../types/product'

const TABLE = 'products' as const

export async function create(payload: NewProduct): Promise<Product> {
  return dbInsert<Product>(TABLE, payload as any)
}

export async function update(
  id: number,
  patch: Partial<NewProduct>
): Promise<Product> {
  return dbUpdate<Product>(TABLE, { id } as any, patch as any)
}

export async function remove(id: number): Promise<void> {
  await dbDelete(TABLE, { id })
}

export async function findById(id: number): Promise<Product | null> {
  const data = await dbSelect<Product[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function list(): Promise<Product[]> {
  return dbSelect<Product[]>(TABLE, (q) => q.select('*').order('id', { ascending: true }))
}

