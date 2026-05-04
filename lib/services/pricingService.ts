import type { PricingResult } from '../types/pricing'
import * as widthRepository from '../repositories/widthRepository'
import * as dropRepository from '../repositories/dropRepository'
import * as pricingGridRepository from '../repositories/pricingGridRepository'
import * as costingRuleRepository from '../repositories/costingRuleRepository'
import { roundTo2 } from '../utils/rounding'

export type PricingInput = {
  productId: number
  fabricGroupId: number
  inputWidth: number
  inputDrop: number
  /** When provided, override only these rules' values; all other rules come from costing_rules table. */
  customRules?: { rule_name: string; rule_type: string; value: number }[]
}

export async function calculatePricing(
  input: PricingInput
): Promise<PricingResult> {
  const { productId, fabricGroupId, inputWidth, inputDrop, customRules } = input

  const [width, drop] = await Promise.all([
    widthRepository.findNearest(inputWidth),
    dropRepository.findNearest(inputDrop),
  ])

  if (!width || !drop) {
    throw new Error('No width/drop configured for the provided dimensions')
  }

  const baseRow = await pricingGridRepository.findBasePrice(
    fabricGroupId,
    width.id,
    drop.id
  )

  if (!baseRow) {
    throw new Error('No base price configured for the provided combination')
  }

  // Always start with costing_rules from the table for this product.
  // When custom rules are provided, override only those rules' values; all others use table values.
  const tableRules = await costingRuleRepository.findByProduct(productId)
  const customMap = new Map<string, number>()
  if (customRules && customRules.length > 0) {
    for (const r of customRules) {
      customMap.set(`${r.rule_name}|${r.rule_type}`, Number(r.value))
    }
  }
  /**
   * Costing sheet rules (table + custom overrides). Rows named "GST" are skipped — the 10% on base is applied in code first.
   */
  const rules = tableRules
    .filter((r) => r.rule_name.trim().toLowerCase() !== 'gst')
    .map((r) => {
      const key = `${r.rule_name}|${r.rule_type}`
      const override = customMap.get(key)
      return {
        rule_type: r.rule_type,
        value: override !== undefined ? override : Number(r.value),
      }
    })

  // 1) Base price from grid, then 10% GST on that base first (e.g. 39 → +3.90 → 42.90)
  let subtotal = roundTo2(baseRow.base_price * 1.1)

  // 2) Remaining costing rules (rental, installation, delivery, etc.)
  for (const rule of rules) {
    if (rule.rule_type === 'percentage') {
      subtotal += (subtotal * rule.value) / 100
    } else if (rule.rule_type === 'fixed') {
      subtotal += rule.value
    }
  }

  // Line amount before quote-level GST; quoteService adds the second 10% on the bill total.
  const subtotalExGst = roundTo2(subtotal)

  return {
    fabricGroupId,
    productId,
    inputWidth,
    inputDrop,
    roundedWidthId: width.id,
    roundedDropId: drop.id,
    basePrice: baseRow.base_price,
    subtotal: subtotalExGst,
    gst: 0,
    finalTotal: subtotalExGst,
  }
}

