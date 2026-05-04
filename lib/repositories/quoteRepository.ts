import { dbInsert, dbSelect, dbUpdate } from '../db/query'
import type { NewQuote, Quote, QuoteStatus } from '../types/quote'

const TABLE = 'quotes' as const

export async function createQuote(payload: NewQuote): Promise<Quote> {
  return dbInsert<Quote>(TABLE, payload as any)
}

export type ListQuotesFilter = {
  createdByUserId?: string
  customerId?: number
  status?: QuoteStatus
}

export async function list(filter: ListQuotesFilter = {}): Promise<Quote[]> {
  const data = await dbSelect<Quote[]>(TABLE, (q) => {
    let chain: ReturnType<typeof q.select> = q.select('*')
    if (filter.createdByUserId != null) {
      chain = chain.eq('created_by_user_id', filter.createdByUserId) as typeof chain
    }
    if (filter.customerId != null) {
      chain = chain.eq('customer_id', filter.customerId) as typeof chain
    }
    if (filter.status != null) {
      chain = chain.eq('status', filter.status) as typeof chain
    }
    return chain.order('created_at', { ascending: false })
  })
  return Array.isArray(data) ? data : []
}

export async function findById(id: number): Promise<Quote | null> {
  const data = await dbSelect<Quote[]>(TABLE, (q) =>
    q.select('*').eq('id', id).limit(1)
  )
  return data[0] ?? null
}

export async function findByQuoteNumber(
  quoteNumber: string
): Promise<Quote | null> {
  const data = await dbSelect<Quote[]>(TABLE, (q) =>
    q.select('*').eq('quote_number', quoteNumber).limit(1)
  )
  return data[0] ?? null
}

export async function updateStatus(
  id: number,
  status: QuoteStatus
): Promise<Quote> {
  return dbUpdate<Quote>(
    TABLE,
    { id } as any,
    { status, updated_at: new Date().toISOString() } as any
  )
}

export async function updateXeroFields(
  id: number,
  patch: Partial<Pick<Quote, 'xero_invoice_id' | 'xero_sync_error'>>
): Promise<Quote> {
  return dbUpdate<Quote>(
    TABLE,
    { id } as any,
    { ...patch, updated_at: new Date().toISOString() } as any
  )
}

export async function updateFinancialFields(
  id: number,
  patch: Partial<
    Pick<
      Quote,
      'base_price' | 'subtotal' | 'gst' | 'final_total' | 'rounded_width_id' | 'rounded_drop_id'
    >
  >
): Promise<Quote> {
  return dbUpdate<Quote>(TABLE, { id } as any, patch as any)
}

