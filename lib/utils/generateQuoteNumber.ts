let inMemoryCounter = 0

export function generateQuoteNumber(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  inMemoryCounter = (inMemoryCounter + 1) % 10000
  const seq = String(inMemoryCounter).padStart(4, '0')
  return `Q-${y}${m}${d}-${seq}`
}

