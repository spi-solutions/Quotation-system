import type { QuoteStatus } from '../types/quote'

const allowedTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  Draft: ['Sent'],
  EmailQueued: ['Approved'],
  Sent: ['Approved'],
  EmailFailed: ['Sent'],
  Approved: ['Invoiced'],
  Invoiced: [],
}

export function canTransition(
  from: QuoteStatus,
  to: QuoteStatus
): boolean {
  return allowedTransitions[from].includes(to)
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: QuoteStatus, to: QuoteStatus) {
    super(`Invalid status transition from ${from} to ${to}`)
    this.name = 'InvalidStatusTransitionError'
  }
}

export function assertValidStatusTransition(
  from: QuoteStatus,
  to: QuoteStatus
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to)
  }
}

export function isStatusLocked(status: QuoteStatus): boolean {
  return status === 'Approved' || status === 'Invoiced'
}

