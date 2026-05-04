import { NextResponse } from 'next/server'
import * as productRepository from '@/lib/repositories/productRepository'
import { filterProductsForQuotes } from '@/lib/products/offering'

export async function GET() {
  try {
    const products = filterProductsForQuotes(await productRepository.list())
    return NextResponse.json({ data: products })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch products'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
