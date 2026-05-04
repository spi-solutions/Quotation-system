import type { QuoteStatus } from '../types/quote'
import * as quoteRepository from '../repositories/quoteRepository'
import {
  assertValidStatusTransition,
  isStatusLocked,
} from '../utils/statusValidator'

export async function updateStatus(
  id: number,
  newStatus: QuoteStatus
) {
  const quote = await quoteRepository.findById(id)

  if (!quote) {
    throw new Error('Quote not found')
  }

  assertValidStatusTransition(quote.status, newStatus)

  if (isStatusLocked(quote.status)) {
    // Financial fields are considered locked; we only allow status change through repository
    return quoteRepository.updateStatus(id, newStatus)
  }

  return quoteRepository.updateStatus(id, newStatus)
}

