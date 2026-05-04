import { dbInsert, dbSelect } from '../db/query'
import type { QuoteItem, NewQuoteItem } from '../types/quote'

const TABLE = 'quote_items' as const

export async function create(payload: NewQuoteItem): Promise<QuoteItem> {
  return dbInsert<QuoteItem>(TABLE, payload as any)
}

export async function listByQuoteId(quoteId: number): Promise<QuoteItem[]> {
  return dbSelect<QuoteItem[]>(TABLE, (q) =>
    q
      .select('*')
      .eq('quote_id', quoteId)
      .order('id', { ascending: true })
  )
}

