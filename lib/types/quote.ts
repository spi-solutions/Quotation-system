export type QuoteStatus =
  | 'Draft'
  | 'EmailQueued'
  | 'Sent'
  | 'EmailFailed'
  | 'Approved'
  | 'Invoiced'

export type Quote = {
  id: number
  quote_number: string
  customer_id: number
  product_id: number
  fabric_group_id: number
  input_width: number
  input_drop: number
  rounded_width_id: number
  rounded_drop_id: number
  base_price: number
  subtotal: number
  gst: number
  final_total: number
  status: QuoteStatus
  created_by_user_id: string | null
  created_at: string
  updated_at: string
  additional_info: string | null
  eta_text: string | null
  xero_invoice_id?: string | null
  xero_sync_error?: string | null
}

export type NewQuote = Omit<Quote, 'id' | 'created_at' | 'updated_at'>

export type QuoteItem = {
  id: number
  quote_id: number
  product_id: number
  fabric_group_id: number
  input_width: number
  input_drop: number
  rounded_width_id: number
  rounded_drop_id: number
  base_price: number
  subtotal: number
  gst: number
  final_total: number
  quantity: number
  location_label: string
  location_other: string | null
}

export type NewQuoteItem = Omit<QuoteItem, 'id'>

