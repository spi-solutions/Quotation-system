import { supabaseAdmin } from './supabase'

type TableName =
  | 'customers'
  | 'products'
  | 'fabric_groups'
  | 'widths'
  | 'drops'
  | 'roller_pricing_grid'
  | 'costing_rules'
  | 'quotes'
  | 'quote_items'
  | 'profiles'
  | 'users'
  | 'xero_tokens'
  | 'password_reset_tokens'

export class DbError extends Error {
  constructor(
    message: string,
    public readonly context?: { table?: TableName; code?: string | null }
  ) {
    super(message)
    this.name = 'DbError'
  }
}

function toFriendlyMessage(
  table: TableName,
  code: string | null,
  raw: string
): string {
  if (code === '23505' || raw.toLowerCase().includes('duplicate key value')) {
    switch (table) {
      case 'customers':
        return 'A customer with these details already exists.'
      case 'quotes':
        return 'A quotation with this number already exists.'
      case 'products':
        return 'A product with these details already exists.'
      case 'fabric_groups':
        return 'This fabric group already exists.'
      case 'widths':
        return 'This width value is already in use.'
      case 'drops':
        return 'This drop value is already in use.'
      case 'roller_pricing_grid':
        return 'This pricing grid row already exists.'
      case 'costing_rules':
        return 'A costing rule with these values already exists.'
      case 'profiles':
        return 'A profile with these details already exists.'
      case 'users':
        return 'A user with these details already exists.'
      default:
        return 'A record with these values already exists.'
    }
  }
  return raw
}

export async function dbSelect<T>(
  table: TableName,
  build: (q: any) => any
): Promise<T> {
  const base = supabaseAdmin.from(table as any)
  const { data, error } = await build(base)

  if (error) {
    const msg = toFriendlyMessage(table, error.code ?? null, error.message)
    throw new DbError(msg, { table, code: error.code })
  }

  return data as T
}

export async function dbInsert<T>(
  table: TableName,
  payload: T
): Promise<T> {
  const { data, error } = await supabaseAdmin
    .from(table as any)
    .insert(payload as any)
    .select()
    .single()

  if (error) {
    const msg = toFriendlyMessage(table, error.code ?? null, error.message)
    throw new DbError(msg, { table, code: error.code })
  }

  return data as T
}

export async function dbUpdate<T>(
  table: TableName,
  match: Partial<T>,
  patch: Partial<T>
): Promise<T> {
  const { data, error } = await supabaseAdmin
    .from(table as any)
    .update(patch as any)
    .match(match as any)
    .select()
    .single()

  if (error) {
    const msg = toFriendlyMessage(table, error.code ?? null, error.message)
    throw new DbError(msg, { table, code: error.code })
  }

  return data as T
}

export async function dbDelete(
  table: TableName,
  match: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from(table as any)
    .delete()
    .match(match)

  if (error) {
    const msg = toFriendlyMessage(table, error.code ?? null, error.message)
    throw new DbError(msg, { table, code: error.code })
  }
}

