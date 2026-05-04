export function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

