export type Customer = {
  id: number
  name: string
  email: string
  phone: string | null
  address: string | null
  created_at: string
  xero_contact_id?: string | null
}

export type NewCustomer = Omit<Customer, 'id' | 'created_at'>

