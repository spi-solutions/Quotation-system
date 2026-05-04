import * as productRepository from '@/lib/repositories/productRepository'

const CURTAIN_WORD_RE = /\bcurtains?\b/i

export function isCurtainProductName(name: string): boolean {
  return CURTAIN_WORD_RE.test(String(name).trim())
}

export function filterProductsForQuotes<T extends { name: string }>(products: T[]): T[] {
  return products.filter((p) => !isCurtainProductName(p.name))
}

export async function assertProductsAllowedForQuote(productIds: number[]): Promise<void> {
  const unique = Array.from(new Set(productIds))
  for (const id of unique) {
    const product = await productRepository.findById(id)
    if (!product) {
      throw new Error('Invalid product selected')
    }
    if (isCurtainProductName(product.name)) {
      throw new Error('Curtain products are not available for quotation at this time')
    }
  }
}
