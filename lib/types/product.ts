export type Product = {
  id: number
  name: string
  pricing_type: string
}

export type NewProduct = Omit<Product, 'id'>

